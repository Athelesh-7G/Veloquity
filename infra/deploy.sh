#!/bin/bash
# =============================================================
# Veloquity MVP — One-command deploy script
# Usage: bash infra/deploy.sh [dev|staging|prod]
# =============================================================

set -euo pipefail

ENV=${1:-dev}
STACK_NAME="veloquity-${ENV}"
TEMPLATE="infra/cloudformation.yaml"
PARAMS="infra/parameters.json"
REGION=${AWS_REGION:-us-east-1}

echo "=================================================="
echo " Veloquity Deploy — ENV=${ENV}  REGION=${REGION}"
echo "=================================================="

# 1. Package Lambda code — all 4 Lambdas import api.db (Secrets Manager + psycopg2)
#    so every zip must bundle: the Lambda's own package(s) + api/ + psycopg2-binary (Linux).
echo "[1/6] Packaging Lambda functions..."
mkdir -p .build

# Shared step: install psycopg2-binary for Linux x86_64 into a reusable deps dir.
echo "  Installing psycopg2-binary (Linux x86_64) for Lambda bundling..."
rm -rf .build/deps
mkdir -p .build/deps
python3 -m pip install psycopg2-binary \
  --platform manylinux2014_x86_64 \
  --python-version 3.12 \
  --only-binary=:all: \
  -t .build/deps \
  --quiet

# ML stack (numpy/scipy/scikit-learn/hdbscan/joblib) now ships as a Lambda LAYER
# rather than inside evidence.zip. This drops evidence.zip from ~81MB to ~3MB, so
# routine code deploys upload 3MB instead of 81MB and the ML stack is re-uploaded
# only when its pins change. Only the Evidence Lambda attaches the layer.
#
# NOTE: a layer does NOT get its own 250MB budget — AWS counts function code and
# every attached layer against the SAME 250MB unzipped quota. This split is a
# deploy-speed and separation win, not extra headroom. To actually raise the
# ceiling, move Evidence to container-image packaging (10GB limit).
echo "  Building ML Lambda Layer (numpy/scipy/scikit-learn/hdbscan/joblib)..."
rm -rf .build/layer_ml
mkdir -p .build/layer_ml/python
python3 -m pip install \
  numpy==2.0.2 \
  scipy==1.13.1 \
  scikit-learn==1.6.1 \
  hdbscan==0.8.42 \
  joblib \
  --platform manylinux2014_x86_64 \
  --python-version 3.12 \
  --only-binary=:all: \
  -t .build/layer_ml/python \
  --quiet

# Prune: the layer counts against the function's 250MB unzipped quota, so this
# still matters. Test suites, package metadata, and bytecode caches are not
# needed at runtime and account for tens of MB across numpy/scipy/scikit-learn.
echo "  Pruning ML Layer (tests, dist-info, __pycache__)..."
find .build/layer_ml/python -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find .build/layer_ml/python -name "test_*.py" -delete 2>/dev/null || true
find .build/layer_ml/python -type d -name "*.dist-info" -exec rm -rf {} + 2>/dev/null || true
find .build/layer_ml/python -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
echo "  ML Layer size: $(du -sh .build/layer_ml | cut -f1)"

rm -f .build/layer_ml.zip
(cd .build/layer_ml && zip -r ../layer_ml.zip . -x "*.pyc" -x "*__pycache__*") > /dev/null
echo "  Built layer_ml.zip ($(du -sh .build/layer_ml.zip | cut -f1))"

# Helper: build a Lambda zip from one or more source dirs.
# Usage: build_lambda_zip <output.zip> <src_dir> [<src_dir> ...]
# Every zip gets: the Lambda's own package(s) + api/ + psycopg2-binary.
# The ML stack is NOT bundled here — Evidence gets it from the layer at runtime.
build_lambda_zip() {
  local zipfile="$1"; shift
  local pkgdir=".build/pkg_$(basename ${zipfile%.zip})"
  rm -rf "$pkgdir"
  cp -r .build/deps "$pkgdir"
  for srcdir in "$@"; do
    cp -r "$srcdir" "$pkgdir/"
  done
  cp -r api "$pkgdir/"
  (cd "$pkgdir" && zip -r "../$(basename $zipfile)" . -x "*.pyc" -x "*__pycache__*") > /dev/null
  echo "  Built $zipfile ($(du -sh .build/$(basename $zipfile) | cut -f1))"
}

echo "  Building ingestion.zip..."
build_lambda_zip .build/ingestion.zip ingestion

echo "  Building evidence.zip..."
build_lambda_zip .build/evidence.zip evidence

echo "  Building governance.zip..."
build_lambda_zip .build/governance.zip governance output

echo "  Building reasoning.zip..."
build_lambda_zip .build/reasoning.zip reasoning lambda_reasoning

# 2. Upload Lambda zips to a deployment S3 bucket
DEPLOY_BUCKET="veloquity-deploy-${ENV}-$(aws sts get-caller-identity --query Account --output text)"

echo "[2/6] Uploading Lambda packages to s3://${DEPLOY_BUCKET}..."
aws s3 mb s3://${DEPLOY_BUCKET} --region ${REGION} 2>/dev/null || true
aws s3 cp .build/ingestion.zip  s3://${DEPLOY_BUCKET}/lambda/ingestion.zip
aws s3 cp .build/evidence.zip   s3://${DEPLOY_BUCKET}/lambda/evidence.zip
aws s3 cp .build/reasoning.zip  s3://${DEPLOY_BUCKET}/lambda/reasoning.zip
aws s3 cp .build/governance.zip s3://${DEPLOY_BUCKET}/lambda/governance.zip
aws s3 cp .build/layer_ml.zip   s3://${DEPLOY_BUCKET}/lambda/layer_ml.zip --region ${REGION}

# 3. Validate CloudFormation template
echo "[3/6] Validating CloudFormation template..."
aws cloudformation validate-template \
  --template-body file://${TEMPLATE} \
  --region ${REGION} > /dev/null

echo "  Template valid."

# 4. Deploy CloudFormation stack
echo "[4/6] Deploying CloudFormation stack: ${STACK_NAME}..."

# Convert parameters.json array to Key=Value pairs for `aws cloudformation deploy`
PARAM_OVERRIDES=$(python3 -c "
import json, sys
params = json.load(open('${PARAMS}'))
print(' '.join(p['ParameterKey']+'='+p['ParameterValue'] for p in params))
")

aws cloudformation deploy \
  --stack-name ${STACK_NAME} \
  --template-file ${TEMPLATE} \
  --parameter-overrides ${PARAM_OVERRIDES} DeployBucket=${DEPLOY_BUCKET} \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ${REGION} \
  --tags Project=Veloquity Env=${ENV}

echo "  Stack deployed."

# 5. Force Lambda code updates.
# CloudFormation does NOT re-deploy a function's code when the template's
# Code.S3Key string is unchanged (e.g. lambda/evidence.zip), even though the S3
# object's *contents* changed. The stack reports UPDATE_COMPLETE while the
# functions keep running their old code. Explicitly push each freshly-uploaded
# zip and wait for it to activate so code changes actually ship on every deploy.
# Runs BEFORE migrations on purpose: the migration step depends on a local psql
# client and must never be able to skip the code update if psql is missing.
echo "[5/6] Forcing Lambda code updates from s3://${DEPLOY_BUCKET}..."

# Publish a new ML layer version and attach it to the Evidence function.
# Same reason as the code-update loop below: CloudFormation will not publish a
# new LayerVersion while the template's S3Key string is unchanged, so the layer
# content would silently go stale exactly like the function code did.
echo "  Publishing ML Layer..."
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name veloquity-ml-layer-${ENV} \
  --content S3Bucket=${DEPLOY_BUCKET},S3Key=lambda/layer_ml.zip \
  --compatible-runtimes python3.12 \
  --compatible-architectures x86_64 \
  --region ${REGION} \
  --query 'LayerVersionArn' --output text)
echo "  Layer ARN: ${LAYER_ARN}"

echo "  Attaching ML Layer to veloquity-evidence-${ENV}..."
aws lambda update-function-configuration \
  --function-name veloquity-evidence-${ENV} \
  --layers ${LAYER_ARN} \
  --region ${REGION} > /dev/null
# Required: a config update puts the function in Pending. Without this wait the
# update-function-code call below races it and fails with ResourceConflictException.
aws lambda wait function-updated \
  --function-name veloquity-evidence-${ENV} \
  --region ${REGION}

for fn in ingestion evidence reasoning governance; do
  FUNCTION_NAME="veloquity-${fn}-${ENV}"
  echo "  Updating ${FUNCTION_NAME} (lambda/${fn}.zip)..."
  aws lambda update-function-code \
    --function-name ${FUNCTION_NAME} \
    --s3-bucket ${DEPLOY_BUCKET} \
    --s3-key lambda/${fn}.zip \
    --region ${REGION} \
    --query 'LastUpdateStatus' --output text > /dev/null
  aws lambda wait function-updated \
    --function-name ${FUNCTION_NAME} \
    --region ${REGION}
  LAST_MODIFIED=$(aws lambda get-function-configuration \
    --function-name ${FUNCTION_NAME} \
    --query 'LastModified' --output text \
    --region ${REGION})
  echo "    ${FUNCTION_NAME} code updated — LastModified: ${LAST_MODIFIED}"
done

# 6. Run DB migrations
echo "[6/6] Running database migrations..."

DB_SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --query "Stacks[0].Outputs[?OutputKey=='DBSecretArn'].OutputValue" \
  --output text \
  --region ${REGION})

DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --query "Stacks[0].Outputs[?OutputKey=='DBEndpoint'].OutputValue" \
  --output text \
  --region ${REGION})

DB_CREDS=$(aws secretsmanager get-secret-value \
  --secret-id ${DB_SECRET_ARN} \
  --query SecretString \
  --output text \
  --region ${REGION})

DB_USER=$(echo $DB_CREDS | python3 -c "import sys,json; print(json.load(sys.stdin)['username'])")
DB_PASS=$(echo $DB_CREDS | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")
DB_NAME="veloquity"

export PGPASSWORD=${DB_PASS}

for migration in db/migrations/*.sql; do
  echo "  Applying: ${migration}"
  psql -h ${DB_ENDPOINT} -U ${DB_USER} -d ${DB_NAME} -f ${migration}
done

echo ""
echo "=================================================="
echo " Veloquity deploy complete!"
echo ""

REPORT_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --query "Stacks[0].Outputs[?OutputKey=='ReportBucketWebsiteURL'].OutputValue" \
  --output text \
  --region ${REGION})

echo "  Report URL : ${REPORT_URL}"
echo "  DB Endpoint: ${DB_ENDPOINT}"
echo "  Stack Name : ${STACK_NAME}"
echo "=================================================="
