import React from 'react';
import { zyntrixSignalGate } from '@/external/bot-skeleton/services/zyntrix-signal-gate';
import './zyntrix-bridge-panel.scss';

const statusLabels: Record<string, string> = {
    NOT_CONNECTED: 'Open Zyntrix analysis to connect.',
    ANALYSIS_OPEN: 'Zyntrix opened · establishing secure connection.',
    ANALYSIS_HANDSHAKE: 'Zyntrix handshake received · connecting.',
    ANALYSIS_CONNECTED: 'Zyntrix connected · live signal channel ready.',
    OPEN_ANALYSIS_FIRST: 'Open Zyntrix analysis before expecting a trade.',
    WAITING_FOR_SIGNAL: 'RUNNING · waiting for a fresh OVER 1 PASS.',
    PASS_CONSUMED: 'Fresh PASS received · DBot may execute one purchase.',
    STOPPED: 'Bot stopped · signal wait cancelled.',
    POPUP_BLOCKED: 'Popup blocked · allow popups and try again.',
    REJECTED_STALE_OR_INVALID: 'Signal rejected · stale or invalid data.',
    REJECTED_REPLAYED_TICK: 'Signal rejected · this live tick was already used.',
    MARKET_OR_CONTRACT_MISMATCH: 'Signal rejected · check the market and DIGIT OVER contract.',
};

const ZyntrixBridgePanel = () => {
    const [status, setStatus] = React.useState(zyntrixSignalGate.getStatus());

    React.useEffect(() => {
        const handleStatus = (event: Event) => {
            const nextStatus = (event as CustomEvent<{ status: string }>).detail?.status;
            if (nextStatus) setStatus(nextStatus);
        };
        window.addEventListener('zyntrix-bridge-status', handleStatus);
        return () => window.removeEventListener('zyntrix-bridge-status', handleStatus);
    }, []);

    return (
        <section className='zyntrix-bridge-panel' aria-label='Zyntrix signal connection'>
            <div className='zyntrix-bridge-copy'>
                <strong>ZYNTRIX SIGNAL GATE</strong>
                <span>DBot waits for a fresh OVER 1 PASS before every purchase. Select the same market in both apps.</span>
                <small aria-live='polite'>{statusLabels[status] || status}</small>
            </div>
            <button type='button' className='zyntrix-bridge-open' onClick={() => zyntrixSignalGate.openAnalysisWindow()}>
                Open Zyntrix Analysis
            </button>
        </section>
    );
};

export default ZyntrixBridgePanel;
