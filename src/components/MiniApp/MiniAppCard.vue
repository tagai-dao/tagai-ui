<template>
  <div class="miniapp-card" @click="$emit('click')">
    <div class="card-icon-container">
      <img :src="app.iconUrl" :alt="app.name" class="card-icon" />
      <div v-if="app.verified" class="verified-badge" title="Verified">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 0L9.8 5.6L16 6.4L11.6 10.4L13.2 16L8 12.8L2.8 16L4.4 10.4L0 6.4L6.2 5.6L8 0Z" fill="#5b21b6"/>
        </svg>
      </div>
    </div>
    <h3 class="card-title">{{ app.name }}</h3>
    <p class="card-subtitle" v-if="app.subtitle">{{ app.subtitle }}</p>
    <div class="card-tags" v-if="app.tags && app.tags.length > 0">
      <span v-for="tag in app.tags.slice(0, 2)" :key="tag" class="tag">
        {{ tag }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface MiniApp {
  domain: string;
  name: string;
  iconUrl: string;
  subtitle?: string;
  category: string;
  tags: string[];
  verified?: boolean;
}

defineProps<{
  app: MiniApp;
}>();

defineEmits<{
  click: [];
}>();
</script>

<style scoped>
.miniapp-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.miniapp-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  border-color: #5b21b6;
}

.card-icon-container {
  position: relative;
  margin-bottom: 12px;
}

.card-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
}

.verified-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: white;
  border-radius: 50%;
  padding: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.card-subtitle {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
  min-height: 2.8em;
}

.card-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.tag {
  font-size: 10px;
  padding: 2px 8px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
}
</style>
