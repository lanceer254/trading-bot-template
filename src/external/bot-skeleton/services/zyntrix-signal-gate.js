const ZYNTRIX_URL = 'https://lanceer254.github.io/mirror/';
const ZYNTRIX_ORIGIN = new URL(ZYNTRIX_URL).origin;
const MESSAGE_TYPE = 'ZYNTRIX_SIGNAL';
const PROTOCOL_VERSION = 1;
const MAX_SIGNAL_AGE_MS = 3000;

const REQUIRED_THRESHOLDS = [
    ['over0', 95],
    ['over1', 85],
    ['over2', 75],
    ['over3', 65],
];

const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);

export const isValidZyntrixPass = (message, now = Date.now()) => {
    if (!message || typeof message !== 'object') return false;
    if (message.type !== MESSAGE_TYPE || message.version !== PROTOCOL_VERSION) return false;
    if (message.status !== 'PASS' || message.strategy !== 'OVER1') return false;
    if (message.contract !== 'DIGITOVER' || message.prediction !== 1) return false;
    if (typeof message.signalId !== 'string' || !message.signalId) return false;
    if (typeof message.sessionId !== 'string' || !message.sessionId) return false;
    if (!Number.isInteger(message.tickSequence) || message.tickSequence < 1) return false;
    if (!isFiniteNumber(message.timestamp) || now - message.timestamp < 0 || now - message.timestamp > MAX_SIGNAL_AGE_MS) {
        return false;
    }
    if (message.sampleSize !== 60 || typeof message.market !== 'string' || !message.market) return false;

    return REQUIRED_THRESHOLDS.every(([key, threshold]) => {
        const metric = message.metrics?.[key];
        return (
            metric &&
            isFiniteNumber(metric.actualPercent) &&
            isFiniteNumber(metric.thresholdPercent) &&
            metric.thresholdPercent === threshold &&
            metric.actualPercent + 1e-9 >= threshold
        );
    });
};

class ZyntrixSignalGate {
    constructor() {
        this.active = false;
        this.popup = null;
        this.pending = null;
        this.status = 'NOT_CONNECTED';
        this.seenSignalIds = new Set();
        this.lastTickSequenceBySession = new Map();
        this.handleMessage = this.handleMessage.bind(this);
        if (typeof window !== 'undefined') {
            window.addEventListener('message', this.handleMessage);
        }
    }

    setStatus(status) {
        this.status = status;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('zyntrix-bridge-status', { detail: { status } }));
        }
    }

    getStatus() {
        return this.status;
    }

    openAnalysisWindow() {
        if (this.popup && !this.popup.closed) {
            this.popup.focus();
            this.setStatus('ANALYSIS_OPEN');
            return true;
        }

        this.popup = window.open(ZYNTRIX_URL, 'zyntrix-analysis');

        if (!this.popup) {
            this.setStatus('POPUP_BLOCKED');
            return false;
        }

        this.popup.focus();
        this.setStatus('ANALYSIS_OPEN');
        return true;
    }

    activate() {
        this.active = true;
        // RUN is triggered by a user click, so open the analysis window synchronously here.
        if (!this.popup || this.popup.closed) this.openAnalysisWindow();
        this.setStatus(this.popup && !this.popup.closed ? 'WAITING_FOR_SIGNAL' : 'OPEN_ANALYSIS_FIRST');
    }

    stop() {
        this.active = false;
        if (this.pending) {
            const { resolve } = this.pending;
            this.pending = null;
            resolve(false);
        }
        this.setStatus('STOPPED');
    }

    waitForPass({ market, contractType }) {
        if (!this.active || !market || contractType !== 'DIGITOVER') return Promise.resolve(false);
        if (this.pending) return Promise.resolve(false);

        this.setStatus('WAITING_FOR_SIGNAL');
        return new Promise(resolve => {
            this.pending = { market, contractType, resolve };
        });
    }

    rememberSignal(signalId) {
        this.seenSignalIds.add(signalId);
        if (this.seenSignalIds.size > 500) {
            this.seenSignalIds.delete(this.seenSignalIds.values().next().value);
        }
    }

    handleMessage(event) {
        if (event.origin !== ZYNTRIX_ORIGIN || !this.popup || event.source !== this.popup) return;

        const message = event.data;
        if (message?.type === 'ZYNTRIX_BRIDGE_HELLO' && message.version === PROTOCOL_VERSION) {
            event.source.postMessage({ type: 'ZYNTRIX_BRIDGE_INIT', version: PROTOCOL_VERSION }, ZYNTRIX_ORIGIN);
            this.setStatus('ANALYSIS_HANDSHAKE');
            return;
        }
        if (message?.type === 'ZYNTRIX_BRIDGE_READY' && message.version === PROTOCOL_VERSION) {
            this.setStatus('ANALYSIS_CONNECTED');
            return;
        }
        if (
            !message ||
            message.type !== MESSAGE_TYPE ||
            message.version !== PROTOCOL_VERSION ||
            typeof message.signalId !== 'string' ||
            !message.signalId ||
            typeof message.sessionId !== 'string' ||
            !message.sessionId ||
            typeof message.market !== 'string' ||
            !message.market ||
            !Number.isInteger(message.tickSequence) ||
            message.tickSequence < 1
        ) {
            return;
        }

        if (this.seenSignalIds.has(message.signalId)) return;
        this.rememberSignal(message.signalId);

        const sequenceKey = message.sessionId + ':' + message.market;
        const previousSequence = this.lastTickSequenceBySession.get(sequenceKey) || 0;
        if (message.tickSequence <= previousSequence) {
            this.setStatus('REJECTED_REPLAYED_TICK');
            return;
        }
        this.lastTickSequenceBySession.set(sequenceKey, message.tickSequence);

        if (message.status === 'WAIT') {
            this.setStatus('WAITING_FOR_SIGNAL');
            return;
        }

        if (message.status !== 'PASS' || !this.active || !this.pending) return;

        if (!isValidZyntrixPass(message)) {
            this.setStatus('REJECTED_STALE_OR_INVALID');
            return;
        }

        if (message.market !== this.pending.market || this.pending.contractType !== message.contract) {
            this.setStatus('MARKET_OR_CONTRACT_MISMATCH');
            return;
        }

        const { resolve } = this.pending;
        this.pending = null;
        this.setStatus('PASS_CONSUMED');
        resolve(true);
    }
}

export const zyntrixSignalGate = new ZyntrixSignalGate();
