export const logger = {
    info: (msg: string, data?: any) => {
        console.log(`[INFO] ${msg}`, data ? data : '');
    },
    error: (msg: string, error?: any) => {
        console.error(`[ERROR] ${msg}`, error ? error : '');
    },
    warn: (msg: string, data?: any) => {
        console.warn(`[WARN] ${msg}`, data ? data : '');
    }
};
