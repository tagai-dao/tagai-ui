<template>
  <div class="miniapps-explore">
    <!-- Header -->
    <div class="page-header">
      <h1>Mini Apps</h1>
      <p>Discover apps built for TagAI</p>
    </div>

    <!-- Search Bar -->
    <div class="search-section">
      <div class="search-bar">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="search-icon">
          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="2"/>
          <path d="M12 12L16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search apps..."
          class="search-input"
        />
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="category-tabs">
      <button
        v-for="category in categories"
        :key="category.value"
        :class="['category-tab', { active: selectedCategory === category.value }]"
        @click="selectedCategory = category.value"
      >
        {{ category.label }}
      </button>
    </div>

    <!-- App Grid -->
    <div class="apps-grid" v-if="!loading">
      <MiniAppCard
        v-for="app in filteredApps"
        :key="app.domain"
        :app="app"
        @click="openApp(app)"
      />
    </div>

    <!-- Loading State -->
    <div v-else class="loading-container">
      <div class="spinner"></div>
      <p>Loading apps...</p>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && filteredApps.length === 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>No apps found</h3>
      <p>Try adjusting your search or filters</p>
    </div>

    <!-- Developer CTA -->
    <div class="developer-cta">
      <div class="cta-content">
        <h3>Build Your Own Mini App</h3>
        <p>Create apps that run directly in TagAI</p>
        <button @click="goToDeveloperTools" class="cta-btn">
          Developer Tools
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MiniAppCard from '@/components/MiniApp/MiniAppCard.vue';

interface MiniApp {
  domain: string;
  name: string;
  iconUrl: string;
  subtitle?: string;
  description?: string;
  category: string;
  tags: string[];
  homeUrl: string;
  verified?: boolean;
}

const router = useRouter();

const searchQuery = ref('');
const selectedCategory = ref('all');
const loading = ref(true);
const apps = ref<MiniApp[]>([]);

const categories = [
  { label: 'All', value: 'all' },
  { label: 'Games', value: 'games' },
  { label: 'DeFi', value: 'defi' },
  { label: 'Social', value: 'social' },
  { label: 'Tools', value: 'tools' },
  { label: 'NFT', value: 'nft' },
];

// Filtered apps based on search and category
const filteredApps = computed(() => {
  let result = apps.value;

  // Filter by category
  if (selectedCategory.value !== 'all') {
    result = result.filter(app => app.category === selectedCategory.value);
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(app =>
      app.name.toLowerCase().includes(query) ||
      app.description?.toLowerCase().includes(query) ||
      app.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  return result;
});

onMounted(async () => {
  await loadApps();
});

async function loadApps() {
  loading.value = true;

  try {
    // TODO: Fetch from backend API
    // For now, use mock data
    apps.value = [
      {
        domain: 'example.com',
        name: 'Example App',
        iconUrl: 'https://via.placeholder.com/512/5b21b6/ffffff?text=EA',
        subtitle: 'Demo application',
        description: 'A demonstration Mini App showing TagAI SDK features',
        category: 'tools',
        tags: ['demo', 'example'],
        homeUrl: 'https://example.com',
        verified: true,
      },
      // Add more mock apps for demonstration
      ...Array.from({ length: 9 }, (_, i) => ({
        domain: `app${i + 1}.com`,
        name: `App ${i + 1}`,
        iconUrl: `https://via.placeholder.com/512/${['667eea', '764ba2', '5b21b6', '6d28d9'][i % 4]}/ffffff?text=A${i + 1}`,
        subtitle: `Sample app ${i + 1}`,
        description: `Description for app ${i + 1}`,
        category: ['games', 'defi', 'social', 'tools', 'nft'][i % 5],
        tags: ['tag1', 'tag2'],
        homeUrl: `https://app${i + 1}.com`,
        verified: i % 3 === 0,
      })),
    ];
  } catch (error) {
    console.error('Failed to load apps:', error);
  } finally {
    loading.value = false;
  }
}

function openApp(app: MiniApp) {
  router.push({
    name: 'miniapp',
    params: { appId: app.domain },
  });
}

function goToDeveloperTools() {
  // TODO: Implement developer tools route
  router.push('/developer/manifest');
}
</script>

<style scoped>
.miniapps-explore {
  min-height: 100vh;
  background: #f9fafb;
  padding-bottom: 80px;
}

.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 40px 20px 60px;
  text-align: center;
}

.page-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
}

.page-header p {
  font-size: 16px;
  opacity: 0.9;
}

.search-section {
  padding: 0 20px;
  margin-top: -30px;
}

.search-bar {
  background: white;
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.search-icon {
  color: #9ca3af;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px;
  color: #111827;
}

.search-input::placeholder {
  color: #9ca3af;
}

.category-tabs {
  display: flex;
  gap: 8px;
  padding: 20px;
  overflow-x: auto;
  scrollbar-width: none;
}

.category-tabs::-webkit-scrollbar {
  display: none;
}

.category-tab {
  padding: 8px 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.category-tab:hover {
  border-color: #5b21b6;
  color: #5b21b6;
}

.category-tab.active {
  background: #5b21b6;
  border-color: #5b21b6;
  color: white;
}

.apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  padding: 0 20px 20px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #5b21b6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 14px;
  color: #6b7280;
}

.developer-cta {
  margin: 40px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  color: white;
}

.cta-content h3 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
}

.cta-content p {
  font-size: 16px;
  opacity: 0.9;
  margin-bottom: 20px;
}

.cta-btn {
  background: white;
  color: #5b21b6;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.cta-btn:hover {
  transform: translateY(-2px);
}

/* Mobile Responsive */
@media (max-width: 640px) {
  .apps-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .page-header {
    padding: 32px 20px 50px;
  }

  .page-header h1 {
    font-size: 28px;
  }
}
</style>
