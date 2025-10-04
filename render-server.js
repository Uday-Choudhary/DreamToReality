const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Main roadmap generation endpoint
app.post('/generate-roadmap', async (req, res) => {
    try {
        const { dream, category } = req.body;

        if (!dream || dream.length < 50) {
            return res.status(400).json({
                error: 'Dream description must be at least 50 characters'
            });
        }

        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!LOVABLE_API_KEY) {
            throw new Error('LOVABLE_API_KEY is not configured');
        }

        const systemPrompt = `You are an expert life coach and goal strategist. Your role is to transform dreams into actionable, structured roadmaps with specific milestones.

Create a detailed, realistic roadmap with 4 phases:
- Phase 1: Learning & Research (Foundation building)
- Phase 2: Prototype/Execution (Initial action)
- Phase 3: Feedback & Iteration (Refinement)
- Phase 4: Growth & Scaling (Achievement & beyond)

For each phase, provide 3-5 specific, actionable milestones with:
1. Clear, measurable objectives
2. Realistic timelines
3. Required skills or resources
4. Success metrics

Be specific and practical. Tailor advice to the user's category: ${category}.

CRITICAL: Respond ONLY with valid JSON. No markdown, no code blocks, just pure JSON.`;

        const userPrompt = `Dream: ${dream}

Category: ${category}

Generate a JSON roadmap with this exact structure:
{
  "goalTitle": "string (compelling title for their goal)",
  "estimatedDuration": "string (e.g., '6-12 months')",
  "phases": [
    {
      "phaseNumber": 1,
      "phaseName": "string",
      "description": "string (what this phase achieves)",
      "duration": "string (e.g., '2-3 weeks')",
      "milestones": [
        {
          "title": "string (specific, actionable)",
          "description": "string (what to do and why)",
          "deadline": "string (relative, e.g., 'Week 2')",
          "skills": ["string", "string"],
          "resources": ["string", "string"],
          "metrics": "string (how to measure success)"
        }
      ]
    }
  ]
}`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            if (response.status === 429) {
                return res.status(429).json({
                    error: 'Rate limit exceeded. Please try again in a moment.'
                });
            }
            if (response.status === 402) {
                return res.status(402).json({
                    error: 'AI credits exhausted. Please add credits to continue.'
                });
            }

            const errorText = await response.text();
            console.error('AI Gateway error:', response.status, errorText);
            throw new Error(`AI Gateway error: ${response.status}`);
        }

        const data = await response.json();
        let roadmapText = data.choices[0].message.content;

        // Clean up response - remove markdown code blocks if present
        roadmapText = roadmapText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let roadmap;
        try {
            roadmap = JSON.parse(roadmapText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Raw response:', roadmapText);
            throw new Error('Failed to parse AI response as JSON');
        }

        res.json({ roadmap });

    } catch (error) {
        console.error('Error in generate-roadmap:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'An unexpected error occurred'
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
