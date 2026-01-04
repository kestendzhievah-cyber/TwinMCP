'use client'

import React, { useState, useEffect } from 'react'
import { Search, Filter, Star, Download, Sparkles, Zap, TrendingUp, Shield, Users, Clock, Plus, Eye, Heart, ShoppingCart } from 'lucide-react'

interface Agent {
  id: string
  name: string
  description: string
  category: string
  rating: number
  reviews: number
  price: number
  image: string
  creator: string
  downloads: number
  features: string[]
  tags: string[]
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('popular')

  const categories = [
    { id: 'all', name: 'Tous', count: 156 },
    { id: 'sales', name: 'Ventes', count: 42 },
    { id: 'support', name: 'Support', count: 38 },
    { id: 'marketing', name: 'Marketing', count: 29 },
    { id: 'productivity', name: 'Productivité', count: 47 }
  ]

  const featuredAgents: Agent[] = [
    {
      id: '1',
      name: 'Sales Booster Pro',
      description: 'Agent IA avancé pour booster vos ventes et qualifier les leads automatiquement.',
      category: 'sales',
      rating: 4.8,
      reviews: 124,
      price: 99,
      image: '/api/placeholder/300/200',
      creator: 'SalesTech Inc.',
      downloads: 15420,
      features: ['Lead qualification', 'Email automation', 'CRM integration'],
      tags: ['GPT-4', 'CRM', 'Automation']
    },
    {
      id: '2',
      name: 'Customer Support Hero',
      description: 'Assistant support client 24/7 avec réponses personnalisées et résolution de problèmes.',
      category: 'support',
      rating: 4.9,
      reviews: 89,
      price: 79,
      image: '/api/placeholder/300/200',
      creator: 'SupportAI',
      downloads: 8930,
      features: ['24/7 support', 'Multi-language', 'Ticket management'],
      tags: ['Claude', 'Multi-lang', '24/7']
    },
    {
      id: '3',
      name: 'Marketing Genius',
      description: 'Créez du contenu marketing engageant et optimisez vos campagnes publicitaires.',
      category: 'marketing',
      rating: 4.7,
      reviews: 67,
      price: 89,
      image: '/api/placeholder/300/200',
      creator: 'MarketingAI',
      downloads: 5670,
      features: ['Content creation', 'Campaign optimization', 'Social media'],
      tags: ['Gemini', 'Content', 'Social']
    }
  ]

  useEffect(() => {
    // Simulate fetching agents from MCP server
    setAgents([...featuredAgents])
    setFilteredAgents([...featuredAgents])
  }, [])

  useEffect(() => {
    let filtered = agents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           agent.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || agent.category === selectedCategory
      return matchesSearch && matchesCategory
    })

    // Sort agents
    if (sortBy === 'popular') {
      filtered.sort((a, b) => b.downloads - a.downloads)
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating)
    } else if (sortBy === 'price-low') {
      filtered.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price-high') {
      filtered.sort((a, b) => b.price - a.price)
    }

    setFilteredAgents(filtered)
  }, [searchTerm, selectedCategory, sortBy, agents])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price)
  }

  const formatDownloads = (downloads: number) => {
    if (downloads >= 1000000) {
      return `${(downloads / 1000000).toFixed(1)}M`
    } else if (downloads >= 1000) {
      return `${(downloads / 1000).toFixed(1)}K`
    }
    return downloads.toString()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Sparkles className="w-8 h-8 text-purple-400 mr-3" />
            <h1 className="text-4xl font-bold text-white">Marketplace MCP</h1>
          </div>
          <p className="text-xl text-gray-400">
            Découvrez et déployez des agents IA puissants pour votre entreprise
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
          <div className="flex flex-col lg:flex-row gap-4 items-center">

            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher des agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-purple-500 outline-none"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedCategory === category.id
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50'
                  }`}
                >
                  {category.name} ({category.count})
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-purple-500 outline-none"
            >
              <option value="popular">Plus populaires</option>
              <option value="rating">Meilleures notes</option>
              <option value="price-low">Prix croissant</option>
              <option value="price-high">Prix décroissant</option>
            </select>
          </div>
        </div>

        {/* Featured Agents */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <Star className="w-6 h-6 text-yellow-400 mr-2" />
            Agents Vedettes
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredAgents.map((agent) => (
              <div key={agent.id} className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all hover:scale-105">
                <div className="aspect-video bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center">
                  <Sparkles className="w-16 h-16 text-purple-400" />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold text-white">{agent.name}</h3>
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded border border-purple-500/30">
                      {agent.category}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm mb-4">{agent.description}</p>

                  <div className="flex items-center mb-4">
                    <div className="flex items-center mr-4">
                      <Star className="w-4 h-4 text-yellow-400 mr-1" />
                      <span className="text-white font-medium">{agent.rating}</span>
                      <span className="text-gray-400 text-sm ml-1">({agent.reviews})</span>
                    </div>
                    <div className="flex items-center">
                      <Download className="w-4 h-4 text-gray-400 mr-1" />
                      <span className="text-gray-400 text-sm">{formatDownloads(agent.downloads)}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {agent.tags.slice(0, 3).map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-slate-700/50 text-gray-300 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-white">{formatPrice(agent.price)}/mois</span>
                    <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition">
                      Installer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All Agents */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Tous les Agents</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredAgents.map((agent) => (
              <div key={agent.id} className="bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-lg p-4 hover:border-purple-500/50 transition-all hover:scale-105">
                <div className="aspect-square bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg mb-3 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-purple-400" />
                </div>

                <h3 className="text-lg font-bold text-white mb-1">{agent.name}</h3>
                <p className="text-gray-400 text-sm mb-2 line-clamp-2">{agent.description}</p>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-400 mr-1" />
                    <span className="text-white">{agent.rating}</span>
                  </div>
                  <span className="text-purple-400 font-medium">{formatPrice(agent.price)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center p-8 bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/30 rounded-2xl">
          <h3 className="text-3xl font-bold text-white mb-4">
            Vous ne trouvez pas l'agent qu'il vous faut ?
          </h3>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Créez votre propre agent personnalisé avec notre constructeur intuitif et déployez-le sur la marketplace.
          </p>
          <button className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-lg font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition shadow-xl shadow-purple-500/50 flex items-center mx-auto">
            <Plus className="w-5 h-5 mr-2" />
            Créer un Agent
          </button>
        </div>

      </div>
    </div>
  )
}
