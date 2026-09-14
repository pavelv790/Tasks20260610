import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import UpdatePrompt from './components/ui/UpdatePrompt.jsx'

// UpdatePrompt е извън ErrorBoundary-то нарочно: ако App гръмне, проверката
// за нова версия трябва да продължи да работи, за да стигне следващият fix
// през нормалния "Обнови сега" поток, вместо да се налага ръчен reinstall.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <UpdatePrompt />
  </StrictMode>,
)
