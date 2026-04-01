/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Competitions from './pages/Competitions';
import CompetitionDetail from './pages/CompetitionDetail';
import Resources from './pages/Resources';
import ResourceDetail from './pages/ResourceDetail';
import Community from './pages/Community';
import Profile from './pages/Profile';
import AIAssistant from './pages/AIAssistant';
import TeamDetail from './pages/TeamDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="competitions" element={<Competitions />} />
          <Route path="competitions/detail/:id" element={<CompetitionDetail />} />
          <Route path="resources" element={<Resources />} />
          <Route path="resources/detail/:id" element={<ResourceDetail />} />
          <Route path="community" element={<Community />} />
          <Route path="profile" element={<Profile />} />
          <Route path="ai" element={<AIAssistant />} />
          <Route path="teams/detail/:id" element={<TeamDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
