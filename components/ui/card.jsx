"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Card = Card;
exports.CardHeader = CardHeader;
exports.CardTitle = CardTitle;
exports.CardDescription = CardDescription;
exports.CardContent = CardContent;
const react_1 = __importDefault(require("react"));
function Card({ children, className = '' }) {
    return (<div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      {children}
    </div>);
}
function CardHeader({ children, className = '' }) {
    return (<div className={`p-6 pb-0 ${className}`}>
      {children}
    </div>);
}
function CardTitle({ children, className = '' }) {
    return (<h3 className={`text-lg font-semibold ${className}`}>
      {children}
    </h3>);
}
function CardDescription({ children, className = '' }) {
    return (<p className={`text-sm text-gray-600 ${className}`}>
      {children}
    </p>);
}
function CardContent({ children, className = '' }) {
    return (<div className={`p-6 pt-0 ${className}`}>
      {children}
    </div>);
}
//# sourceMappingURL=card.jsx.map