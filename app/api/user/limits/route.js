"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const firebase_admin_1 = require("@/lib/firebase-admin");
const user_limits_1 = require("@/lib/user-limits");
async function GET(request) {
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
        // Get user limits and usage
        const limitsData = await (0, user_limits_1.getUserLimits)(userId);
        return server_1.NextResponse.json(limitsData);
    }
    catch (error) {
        console.error('Error getting user limits:', error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map