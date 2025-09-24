<template>
    <div>

    </div>
</template>

<script setup lang="ts">


function getCleanLocalPart(email: string) {
  // 取本地部分
  if (!email.includes('@')) return '';
  const localPart = email.match(/^([^@]+)/)?.[1] ?? '';
  // 去掉非字母数字
  return localPart.replace(/[^A-Za-z0-9]/g, '');
}

</script>

<style lang="scss" scoped>

</style>