import { isValidZyntrixPass } from './zyntrix-signal-gate';

const makeSignal = (overrides = {}) => ({
    type: 'ZYNTRIX_SIGNAL',
    version: 1,
    signalId: 'signal-1',
    sessionId: 'session-1',
    tickSequence: 5,
    status: 'PASS',
    strategy: 'OVER1',
    contract: 'DIGITOVER',
    prediction: 1,
    market: '1HZ100V',
    sampleSize: 60,
    metrics: {
        over0: { actualPercent: 96, thresholdPercent: 95 },
        over1: { actualPercent: 86, thresholdPercent: 85 },
        over2: { actualPercent: 76, thresholdPercent: 75 },
        over3: { actualPercent: 66, thresholdPercent: 65 },
    },
    timestamp: 10000,
    ...overrides,
});

describe('Zyntrix PASS validation', () => {
    it('accepts a fresh PASS with all four thresholds satisfied', () => {
        expect(isValidZyntrixPass(makeSignal(), 12000)).toBe(true);
    });

    it('rejects a stale signal', () => {
        expect(isValidZyntrixPass(makeSignal(), 14001)).toBe(false);
    });

    it('rejects a signal timestamped in the future', () => {
        expect(isValidZyntrixPass(makeSignal(), 9999)).toBe(false);
    });

    it('rejects a PASS if any threshold is below its required value', () => {
        const signal = makeSignal({
            metrics: {
                ...makeSignal().metrics,
                over2: { actualPercent: 74.99, thresholdPercent: 75 },
            },
        });
        expect(isValidZyntrixPass(signal, 12000)).toBe(false);
    });

    it('rejects the wrong contract or prediction', () => {
        expect(isValidZyntrixPass(makeSignal({ contract: 'DIGITUNDER' }), 12000)).toBe(false);
        expect(isValidZyntrixPass(makeSignal({ prediction: 2 }), 12000)).toBe(false);
    });

    it('rejects incomplete samples and missing market identity', () => {
        expect(isValidZyntrixPass(makeSignal({ sampleSize: 59 }), 12000)).toBe(false);
        expect(isValidZyntrixPass(makeSignal({ market: '' }), 12000)).toBe(false);
    });
});
