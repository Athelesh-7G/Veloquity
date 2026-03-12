import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Agents from './pages/Agents'
import Chat from './pages/Chat'
import Dashboard from './pages/Dashboard'
import Docs from './pages/Docs'
import Evidence from './pages/Evidence'
import Governance from './pages/Governance'
import Recommendations from './pages/Recommendations'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/evidence" element={<Evidence />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/governance" element={<Governance />} />
          <Route path="/docs" element={<Docs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
