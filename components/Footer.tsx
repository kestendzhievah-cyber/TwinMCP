export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">TwinMCP</h3>
            <p className="text-sm text-gray-600">
              Plateforme SaaS pour créer, gérer et optimiser des agents d'intelligence artificielle personnalisés.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Liens rapides</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="/pricing" className="hover:text-gray-900">Tarifs</a></li>
              <li><a href="/contact" className="hover:text-gray-900">Contact</a></li>
              <li><a href="/dashboard" className="hover:text-gray-900">Dashboard</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Support</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="#" className="hover:text-gray-900">Documentation</a></li>
              <li><a href="#" className="hover:text-gray-900">API</a></li>
              <li><a href="#" className="hover:text-gray-900">Aide</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            © 2025 TwinMCP. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
