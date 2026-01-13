"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
// Assuming authentication middleware sets req.user
// For example, using NextAuth.js or similar
async function GET(req) {
    // Extract userId from query or params
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    if (!req.user || !userId || userId !== req.user.id) {
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Your chat logic here
    return server_1.NextResponse.json({ message: 'Chat endpoint working' });
}
async function POST(req) {
    // Similar check for POST
    const body = await req.json();
    const userId = body.userId;
    if (!req.user || !userId || userId !== req.user.id) {
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Handle chat creation or message
    return server_1.NextResponse.json({ success: true });
}
//# sourceMappingURL=route.js.map