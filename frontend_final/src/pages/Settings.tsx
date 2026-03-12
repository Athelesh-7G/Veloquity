import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings2, Bell, Shield, Database, Key, Users, Save, AlertTriangle } from 'lucide-react'

export default function Settings() {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [slackNotifications, setSlackNotifications] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)
  const [autoCluster, setAutoCluster] = useState(true)
  const [governanceAlerts, setGovernanceAlerts] = useState(true)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your workspace configuration</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general"><Settings2 className="w-4 h-4 mr-2" />General</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-2" />Notifications</TabsTrigger>
          <TabsTrigger value="security"><Shield className="w-4 h-4 mr-2" />Security</TabsTrigger>
          <TabsTrigger value="data"><Database className="w-4 h-4 mr-2" />Data</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Workspace</CardTitle>
              <CardDescription>Basic workspace settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input id="workspace-name" defaultValue="Veloquity Production" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace-url">Workspace URL</Label>
                <Input id="workspace-url" defaultValue="veloquity.io" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" defaultValue="UTC" />
              </div>
              <Button className="bg-gradient-to-r from-blue-600 to-violet-600 text-white">
                <Save className="w-4 h-4 mr-2" />Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Intelligence Engine</CardTitle>
              <CardDescription>Configure how Veloquity processes feedback</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Auto-clustering</p>
                  <p className="text-xs text-muted-foreground">Automatically cluster new feedback on ingestion</p>
                </div>
                <Switch checked={autoCluster} onCheckedChange={setAutoCluster} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Governance alerts</p>
                  <p className="text-xs text-muted-foreground">Alert when stale signals are detected</p>
                </div>
                <Switch checked={governanceAlerts} onCheckedChange={setGovernanceAlerts} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Bell className="w-5 h-5 text-violet-600" />Notification Preferences</CardTitle>
              <CardDescription>Control how and when you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Email notifications</p>
                  <p className="text-xs text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Slack notifications</p>
                  <p className="text-xs text-muted-foreground">Send digest to connected Slack workspace</p>
                </div>
                <Switch checked={slackNotifications} onCheckedChange={setSlackNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Weekly digest</p>
                  <p className="text-xs text-muted-foreground">Receive a weekly summary of insights</p>
                </div>
                <Switch checked={weeklyDigest} onCheckedChange={setWeeklyDigest} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Key className="w-5 h-5 text-violet-600" />API Keys</CardTitle>
              <CardDescription>Manage API access credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Production API Key</Label>
                <div className="flex gap-2">
                  <Input value="vlq_sk_live_xxxxxxxxxxxxxxxxxxxxxxxx" readOnly className="font-mono text-sm" />
                  <Button variant="outline">Copy</Button>
                  <Button variant="outline" className="text-red-500">Revoke</Button>
                </div>
              </div>
              <Button variant="outline"><Key className="w-4 h-4 mr-2" />Generate New Key</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-violet-600" />Team Access</CardTitle>
              <CardDescription>Manage team members and permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: 'Sarah Chen', email: 'sarah@company.com', role: 'Admin' },
                { name: 'Marcus Johnson', email: 'marcus@company.com', role: 'Editor' },
                { name: 'Priya Patel', email: 'priya@company.com', role: 'Viewer' },
              ].map((member) => (
                <div key={member.email} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant="secondary">{member.role}</Badge>
                </div>
              ))}
              <Button variant="outline" className="w-full"><Users className="w-4 h-4 mr-2" />Invite Team Member</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Database className="w-5 h-5 text-violet-600" />Data Management</CardTitle>
              <CardDescription>Manage your data retention and export settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Data Retention Period</Label>
                <Input defaultValue="90 days" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline">Export All Data</Button>
                <Button variant="outline">Download Report</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5" />Danger Zone</CardTitle>
              <CardDescription>Irreversible actions — proceed with caution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-red-500/20">
                <div>
                  <p className="text-sm font-medium">Clear all feedback data</p>
                  <p className="text-xs text-muted-foreground">Permanently delete all ingested feedback items</p>
                </div>
                <Button variant="outline" className="text-red-500 border-red-500/30 hover:bg-red-500/10">Clear Data</Button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-red-500/20">
                <div>
                  <p className="text-sm font-medium">Delete workspace</p>
                  <p className="text-xs text-muted-foreground">Permanently delete this workspace and all data</p>
                </div>
                <Button variant="outline" className="text-red-500 border-red-500/30 hover:bg-red-500/10">Delete</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
