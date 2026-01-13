"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const firebase_admin_1 = require("@/lib/firebase-admin");
const agents_1 = require("@/lib/agents");
const user_limits_1 = require("@/lib/user-limits");
const qrcode_1 = __importDefault(require("qrcode"));
async function POST(request) {
    try {
        // Verify authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await firebase_admin_1.auth.verifyIdToken(token);
        }
        catch (error) {
            return server_1.NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const body = await request.json();
        // Validate required fields
        if (!body.name || !body.description || !body.model || !body.systemPrompt) {
            return server_1.NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        // Check agent creation limit
        const limitCheck = await (0, user_limits_1.canCreateAgent)(userId);
        if (!limitCheck.allowed) {
            return server_1.NextResponse.json({
                success: false,
                error: 'LIMIT_REACHED',
                message: limitCheck.message,
                currentCount: limitCheck.currentCount,
                maxAllowed: limitCheck.maxAllowed,
                plan: limitCheck.plan,
                suggestedPlan: limitCheck.suggestedUpgrade
            }, { status: 429 });
        }
        // Create the agent
        const agent = await (0, agents_1.createAgent)(userId, body);
        // Update user agents count
        await (0, user_limits_1.updateUserAgentsCount)(userId, (limitCheck.currentCount || 0) + 1);
        // Generate QR Code
        const publicUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}${agent.publicUrl}`;
        const qrCodeDataUrl = await qrcode_1.default.toDataURL(publicUrl, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        const response = {
            success: true,
            chatbotId: agent.id,
            publicUrl,
            qrCode: qrCodeDataUrl,
            newCount: (limitCheck.currentCount || 0) + 1
        };
        return server_1.NextResponse.json(response);
    }
    catch (error) {
        console.error('Error creating chatbot:', error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map