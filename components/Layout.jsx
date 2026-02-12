"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Layout;
const Header_1 = __importDefault(require("./Header"));
const Footer_1 = __importDefault(require("./Footer"));
function Layout({ children }) {
    return (<div className="min-h-screen flex flex-col">
      <Header_1.default />
      <main className="flex-grow">
        {children}
      </main>
      <Footer_1.default />
    </div>);
}
//# sourceMappingURL=Layout.jsx.map