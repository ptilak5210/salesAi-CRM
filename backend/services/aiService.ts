import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export async function generateAIReply(messages: { role: string; content: string }[]): Promise<string> {
    try {
        if (!apiKey) {
            console.error("GEMINI_API_KEY is not set in .env");
            return "AI feature not configured.";
        }

        // Format for Gemini API
        // System message first if present
        const systemMsg = messages.find(m => m.role === 'system');
        const otherMsgs = messages.filter(m => m.role !== 'system');
        
        const history = otherMsgs.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
        
        const lastMessage = otherMsgs[otherMsgs.length - 1]?.content || "";

        const prompt = systemMsg 
            ? `System Instructions: ${systemMsg.content}\n\nClient Message: ${lastMessage}\nConversation context: ${history.map(h => `${h.role}: ${h.parts[0].text}`).join("\n")}`
            : `Conversation history:\n${history.map(h => `${h.role}: ${h.parts[0].text}`).join("\n")}\n\nClient: ${lastMessage}`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
        });

        return response.text?.trim() || "Thank you for your message. We'll get back to you soon.";
    } catch (error) {
        console.error("AI Generation Error:", error);
        return "Thank you for your message. Our team will get back to you shortly.";
    }
}
