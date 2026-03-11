import { GoogleGenAI } from "@google/genai";
import { Lead, Message } from "../utils/types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateOutreachMessage = async (
  lead: Lead,
  productContext: string,
  tone: string = 'Professional'
): Promise<string> => {
  try {
    const prompt = `
      You are a top-tier sales agent. Write a ${tone} outreach message to a prospect.
      
      Prospect Details:
      Name: ${lead.name}
      Role: ${lead.role}
      Company: ${lead.company}
      
      Our Product/Service:
      ${productContext}
      
      Goal: Book a meeting.
      Length: Concise (under 100 words).
      Format: Plain text, no subject line.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "Could not generate message.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Error generating draft.";
  }
};

export const generateReply = async (
  lead: Lead,
  history: Message[],
  intent: string
): Promise<string> => {
  try {
    // Format history for context
    const conversationStr = history.map(m => `${m.sender.toUpperCase()}: ${m.content}`).join('\n');

    const prompt = `
      You are a helpful sales assistant. Draft a reply to the following conversation.
      
      Prospect: ${lead.name} from ${lead.company}
      Intent to address: ${intent}
      
      Conversation History:
      ${conversationStr}
      
      Instructions:
      - Be polite and helpful.
      - Keep it short.
      - If the user is asking for price, give a general range or ask for a call.
      - If the user is interested, propose a time to chat.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "Could not generate reply.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Error generating reply.";
  }
};

export const analyzeLeadIntent = async (lastMessage: string): Promise<string> => {
  try {
    const prompt = `
          Analyze the following message from a sales prospect and categorize the intent.
          Message: "${lastMessage}"
          
          Return ONLY one of the following words: Interested, Pricing, Not Interested, Scheduling, Info, Unknown.
        `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "Unknown";
  } catch (error) {
    return "Unknown";
  }
}