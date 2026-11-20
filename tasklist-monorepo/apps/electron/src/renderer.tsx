import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { bootstrapStore } from './app/store/bootstrap';
import './index.css';

async function bootstrap(): Promise<void> {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('缺少 #root 容器');
  }

  const { info } = await bootstrapStore();
  document.title = 'Sylvie TaskList';

  createRoot(container).render(
    <StrictMode>
      <App info={info} />
    </StrictMode>,
  );
}

void bootstrap().catch((error: unknown) => {
  console.error('[renderer] 启动失败', error);
  const container = document.getElementById('root');
  if (container) {
    container.className = 'app-loading';
    container.textContent = '应用启动失败，请重启后再试。';
  }
});
