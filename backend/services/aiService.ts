import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export const generateAIReply = async (messageHistory: { role: string, content: string }[]): Promise<string> => {
    try {
        let systemInstruction = '';
        const contents: any[] = [];

        for (const msg of messageHistory) {
            if (msg.role === 'system') {
                systemInstruction += msg.content + '\n';
            } else {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content || '' }]
                });
            }
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: systemInstruction.trim() || undefined,
                temperature: 0.7,
                maxOutputTokens: 150,
            }
        });

        return response.text || 'Sorry, I am unable to respond at the moment.';
    } catch (error) {
        console.error('Gemini API Error:', error);
        return 'Sorry, I am experiencing technical difficulties.';
    }
};
