import OpenAI from "npm:openai@4.28.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// Maximum retries for OpenAI API calls
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // Increased to 2 seconds
const MAX_RETRY_DELAY = 10000; // Maximum delay of 10 seconds

// Simple in-memory request tracking (resets when function cold starts)
const requestCounts = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
const MAX_REQUESTS_PER_WINDOW = 50;

function canMakeRequest(clientId: string): boolean {
  const now = Date.now();
  const count = requestCounts.get(clientId) || 0;
  
  if (count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  requestCounts.set(clientId, count + 1);
  setTimeout(() => {
    const currentCount = requestCounts.get(clientId) || 0;
    requestCounts.set(clientId, Math.max(0, currentCount - 1));
  }, RATE_LIMIT_WINDOW);
  
  return true;
}

async function callOpenAIWithRetry(openai: OpenAI, messages: any[], retryCount = 0): Promise<any> {
  try {
    return await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      max_tokens: 500,
      temperature: 0.5, // Reduced temperature for more consistent responses
    });
  } catch (error: any) {
    // Check if we should retry
    if (retryCount < MAX_RETRIES && (
      error.status === 429 || // Rate limit
      error.status === 500 || // Server error
      error.status === 503    // Service unavailable
    )) {
      // Exponential backoff with jitter
      const delay = Math.min(
        INITIAL_RETRY_DELAY * Math.pow(2, retryCount) * (0.75 + Math.random() * 0.5),
        MAX_RETRY_DELAY
      );
      await new Promise(resolve => setTimeout(resolve, delay));
      return callOpenAIWithRetry(openai, messages, retryCount + 1);
    }

    // Handle specific OpenAI errors
    if (error.status === 401) {
      throw new Error("Invalid OpenAI API key");
    } else if (error.status === 429) {
      throw new Error("OpenAI API rate limit exceeded");
    } else if (error.status === 404) {
      throw new Error("Invalid OpenAI model specified");
    }

    // Re-throw the original error with more context
    throw new Error(`OpenAI API Error: ${error.message || error.toString()}`);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Verify request method
    if (req.method !== "POST") {
      throw new Error("Method not allowed");
    }

    // Get and validate the request body
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.messages)) {
      throw new Error("Invalid request body");
    }

    // Check rate limit using client IP or a unique identifier
    const clientId = req.headers.get("x-forwarded-for") || "anonymous";
    if (!canMakeRequest(clientId)) {
      return new Response(
        JSON.stringify({
          error: "Too many requests",
          details: "Please try again in a minute",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": "60",
          },
        }
      );
    }

    // Use environment variable for API key
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // System message to define the assistant's behavior
    const systemMessage = {
      role: "system",
      content: `You are a helpful AI assistant for CMC Social, a platform for students. 
      Your primary role is to help students with their academic questions and provide study advice.
      
      Guidelines:
      - Focus on educational content and study-related questions
      - Provide concise, accurate information
      - Be friendly and supportive
      - If asked about non-academic topics, gently redirect to educational content
      - Do not provide answers that could be used for cheating
      - Do not provide personal opinions on controversial topics
      - Keep responses under 300 words
      - Use simple language and avoid jargon
      - Format responses with markdown for readability when appropriate
      
      You have knowledge about various academic subjects including mathematics, science, literature, history, and languages.
      You can help with study techniques, time management, and academic resources.`
    };

    // Add system message to the beginning of the conversation
    const conversation = [systemMessage, ...body.messages];

    // Call OpenAI API with retry logic
    const completion = await callOpenAIWithRetry(openai, conversation);

    if (!completion.choices?.[0]?.message?.content) {
      throw new Error("Invalid response format from OpenAI");
    }

    // Return the response
    return new Response(
      JSON.stringify({
        message: completion.choices[0].message.content,
      }),
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Edge Function Error:", error);
    
    // Return a structured error response with more specific error information
    return new Response(
      JSON.stringify({
        error: error.message || "An unexpected error occurred",
        details: error.toString(),
        type: error.constructor.name,
      }),
      {
        status: error.status || 500,
        headers: corsHeaders,
      }
    );
  }
});