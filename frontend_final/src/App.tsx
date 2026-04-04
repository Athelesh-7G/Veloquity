import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DataModeProvider } from '@/context/DataModeContext'
import AppLayout from '@/components/app/AppLayout'
import Landing from '@/pages/Landing'
import Dashboard from '@/pages/Dashboard'
import DataStudio from '@/pages/DataStudio'
import EvidenceGrid from '@/pages/EvidenceGrid'
import ConfidenceScores from '@/pages/ConfidenceScores'
import DecisionPlayground from '@/pages/DecisionPlayground'
import Themes from '@/pages/Themes'
import Trends from '@/pages/Trends'
import Scenarios from '@/pages/Scenarios'
import ImportSources from '@/pages/ImportSources'
import Agents from '@/pages/Agents'
import Chat from '@/pages/Chat'
import Settings from '@/pages/Settings'
import Metrics from '@/pages/Metrics'

export default function App() {
  return (
    <DataModeProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="data-studio" element={<DataStudio />} />
          <Route path="evidence" element={<EvidenceGrid />} />
          <Route path="confidence" element={<ConfidenceScores />} />
          <Route path="decisions" element={<DecisionPlayground />} />
          <Route path="themes" element={<Themes />} />
          <Route path="trends" element={<Trends />} />
          <Route path="scenarios" element={<Scenarios />} />
          <Route path="import" element={<ImportSources />} />
          <Route path="agents" element={<Agents />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<Settings />} />
          <Route path="metrics" element={<Metrics />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </DataModeProvider>
  )
}
