<template>
  <div class="transactions-container">
    <el-container>
      <el-header>
        <div class="header-content">
          <h1>OpenClaw 工资管理系统</h1>
          <div class="header-actions">
            <el-button type="danger" @click="handleLogout">退出登录</el-button>
          </div>
        </div>
      </el-header>

      <el-container>
        <el-aside width="200px">
          <el-menu :default-active="'/transactions'" router>
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
          <el-card>
            <template #header>
              <div class="card-header">
                <span>交易流水</span>
                <el-select v-model="typeFilter" placeholder="筛选类型" clearable @change="fetchTransactions" style="width: 150px;">
                  <el-option label="收入" value="credit" />
                  <el-option label="支出" value="debit" />
                </el-select>
              </div>
            </template>

            <el-table :data="transactions" v-loading="loading" empty-text="暂无交易记录">
              <el-table-column prop="agent_name" label="Agent" width="120" />
              <el-table-column prop="type" label="类型" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.type === 'credit' ? 'success' : 'danger'">
                    {{ row.type === 'credit' ? '收入' : '支出' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="amount" label="金额" width="120">
                <template #default="{ row }">
                  <span :class="row.type === 'credit' ? 'amount-credit' : 'amount-debit'">
                    {{ row.type === 'credit' ? '+' : '-' }}¥{{ Number(row.amount).toFixed(2) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="描述" show-overflow-tooltip />
              <el-table-column prop="task_description" label="关联任务" show-overflow-tooltip />
              <el-table-column prop="created_at" label="时间" width="180">
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { DataLine, Document, List } from '@element-plus/icons-vue'
import { getTransactions, logout } from '../api'

const router = useRouter()
const loading = ref(false)
const transactions = ref([])
const typeFilter = ref('')

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

const fetchTransactions = async () => {
  loading.value = true
  try {
    const params = {}
    if (typeFilter.value) params.type = typeFilter.value
    const res = await getTransactions(params)
    transactions.value = res.transactions || []
  } catch (error) {
    console.error('Failed to fetch transactions:', error)
  } finally {
    loading.value = false
  }
}

const handleLogout = async () => {
  try {
    await logout()
    router.push('/login')
  } catch {
    router.push('/login')
  }
}

onMounted(fetchTransactions)
</script>

<style scoped>
.transactions-container {
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

.el-aside {
  background-color: #fff;
  border-right: 1px solid #e6e6e6;
}

.el-menu {
  border-right: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.amount-credit {
  color: #67C23A;
  font-weight: bold;
}

.amount-debit {
  color: #F56C6C;
  font-weight: bold;
}
</style>