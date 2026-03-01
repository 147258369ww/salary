<template>
  <div class="dashboard-container">
    <el-container>
      <el-header>
        <div class="header-content">
          <h1>OpenClaw 工资管理系统</h1>
          <div class="header-actions">
            <span class="admin-name">欢迎, {{ adminUsername }}</span>
            <el-button type="danger" @click="handleLogout">退出登录</el-button>
          </div>
        </div>
      </el-header>

      <el-container>
        <el-aside width="200px">
          <el-menu
            :default-active="activeMenu"
            router
          >
            <el-menu-item index="/">
              <el-icon><DataLine /></el-icon>
              <span>仪表盘</span>
            </el-menu-item>
            <el-menu-item index="/applications">
              <el-icon><Document /></el-icon>
              <span>申请审核</span>
            </el-menu-item>
            <el-menu-item index="/transactions">
              <el-icon><List /></el-icon>
              <span>交易流水</span>
            </el-menu-item>
          </el-menu>
        </el-aside>

        <el-main>
          <div class="stats-grid" v-loading="loading">
            <el-card class="stat-card">
              <div class="stat-value">{{ stats.applications?.pending || 0 }}</div>
              <div class="stat-label">待审核申请</div>
            </el-card>

            <el-card class="stat-card">
              <div class="stat-value">{{ stats.applications?.approved || 0 }}</div>
              <div class="stat-label">已通过申请</div>
            </el-card>

            <el-card class="stat-card">
              <div class="stat-value">¥{{ Number(stats.applications?.total_approved_amount || 0).toFixed(2) }}</div>
              <div class="stat-label">已发放工资</div>
            </el-card>

            <el-card class="stat-card">
              <div class="stat-value">{{ stats.totalAgents || 0 }}</div>
              <div class="stat-label">Agent 数量</div>
            </el-card>
          </div>

          <el-card class="recent-card">
            <template #header>
              <span>最近待审核申请</span>
              <el-button type="primary" text @click="$router.push('/applications')">
                查看全部
              </el-button>
            </template>
            <el-table :data="pendingApplications" empty-text="暂无待审核申请">
              <el-table-column prop="agent_name" label="Agent" width="120" />
              <el-table-column prop="task_description" label="任务描述" show-overflow-tooltip />
              <el-table-column prop="expected_salary" label="期望工资" width="120">
                <template #default="{ row }">
                  ¥{{ Number(row.expected_salary).toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column prop="created_at" label="提交时间" width="180">
                <template #default="{ row }">
                  {{ formatDate(row.created_at) }}
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DataLine, Document, List } from '@element-plus/icons-vue'
import { getStats, getApplications, logout } from '../api'

const router = useRouter()
const loading = ref(false)
const stats = ref({})
const pendingApplications = ref([])

const activeMenu = computed(() => router.currentRoute.value.path)
const adminUsername = computed(() => {
  const stored = sessionStorage.getItem('adminUsername')
  return stored || 'Admin'
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

const fetchData = async () => {
  loading.value = true
  try {
    const [statsRes, appsRes] = await Promise.all([
      getStats(),
      getApplications({ status: 'pending', limit: 5 })
    ])
    stats.value = statsRes
    pendingApplications.value = appsRes.applications || []
  } catch (error) {
    console.error('Failed to fetch data:', error)
  } finally {
    loading.value = false
  }
}

const handleLogout = async () => {
  try {
    await logout()
    sessionStorage.removeItem('adminUsername')
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch (error) {
    // Still redirect on error
    router.push('/login')
  }
}

onMounted(fetchData)
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
}

.el-header {
  background-color: #409EFF;
  color: white;
  padding: 0 20px;
}

.header-content {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-content h1 {
  font-size: 20px;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.admin-name {
  font-size: 14px;
}

.el-aside {
  background-color: #fff;
  border-right: 1px solid #e6e6e6;
}

.el-menu {
  border-right: none;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
  padding: 10px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #409EFF;
}

.stat-label {
  color: #909399;
  margin-top: 5px;
}

.recent-card :deep(.el-card__header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>