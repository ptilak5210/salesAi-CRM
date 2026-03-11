export const constants = {
    APP_NAME: 'SalesAI',
    DEFAULT_LEAD_SCORE: 'New',
    API_BASE_URL: process.env.NODE_ENV === 'production' ? 'https://api.salesai.app' : 'http://localhost:3001/api',
};
