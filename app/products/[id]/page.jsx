"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ProductDetailPage;
const navigation_1 = require("next/navigation");
const Layout_1 = __importDefault(require("@/components/Layout"));
async function ProductDetailPage({ params }) {
    const { id } = await params;
    // Temporairement retourner un produit mocké
    // TODO: Implémenter avec le vrai client Prisma quand il sera disponible
    const product = {
        id,
        name: `Produit ${id}`,
        description: 'Description du produit mocké pour le développement.',
        price: 99.99,
        image: null,
        status: 'ACTIVE',
        category: { name: 'Catégorie Test' },
        seller: { name: 'Vendeur Test', email: 'vendeur@test.com' }
    };
    if (!product || product.status !== 'ACTIVE') {
        (0, navigation_1.notFound)();
    }
    return (<Layout_1.default>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            {product.image ? (<img src={product.image} alt={product.name} className="w-full h-96 object-cover rounded-lg"/>) : (<div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-gray-500">Image non disponible</span>
              </div>)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>
            <p className="text-gray-700 mb-4">{product.description}</p>
            <div className="flex justify-between items-center mb-6">
              <span className="text-3xl font-bold text-blue-600">${product.price}</span>
              <span className="text-sm text-gray-500">Catégorie: {product.category.name}</span>
            </div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Vendeur</h3>
              <p className="text-gray-700">{product.seller.name || product.seller.email}</p>
            </div>
            <button className="w-full bg-blue-600 text-white px-6 py-3 rounded-md text-lg font-medium hover:bg-blue-700 transition-colors">
              Ajouter au panier
            </button>
          </div>
        </div>
      </div>
    </Layout_1.default>);
}
//# sourceMappingURL=page.jsx.map