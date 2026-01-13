"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LimitsDisplay = LimitsDisplay;
const react_1 = __importDefault(require("react"));
function LimitsDisplay({ limits, showUpgradeButton, onUpgrade }) {
    return (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
      {/* Agents Limit */}
      <div className="p-4 border rounded-lg border-purple-500/20">
        <div className="text-sm text-gray-400 mb-2">Agents IA</div>
        <div className="text-2xl font-bold text-white">{limits.agents.current}/{limits.agents.max}</div>
        <div className="text-xs text-gray-500 mt-1">{limits.agents.remaining} restants</div>
        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
          <div className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${Math.min(limits.agents.percentage, 100)}%` }}/>
        </div>
      </div>

      {/* Conversations Limit */}
      <div className="p-4 border rounded-lg border-purple-500/20">
        <div className="text-sm text-gray-400 mb-2">Conversations</div>
        <div className="text-2xl font-bold text-white">{limits.conversations.current.toLocaleString()}/{limits.conversations.max.toLocaleString()}</div>
        <div className="text-xs text-gray-500 mt-1">{limits.conversations.remaining.toLocaleString()} restantes</div>
        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
          <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${Math.min(limits.conversations.percentage, 100)}%` }}/>
        </div>
      </div>

      {showUpgradeButton && onUpgrade && (<div className="md:col-span-2 flex justify-center mt-4">
          <button onClick={onUpgrade} className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition">
            Mettre à niveau
          </button>
        </div>)}
    </div>);
}
//# sourceMappingURL=LimitsDisplay.jsx.map