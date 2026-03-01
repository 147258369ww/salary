<template>
  <div class="applications-container">
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
          <el-menu :default-active="'/applications'" router>
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
                <span>工资申请列表</span>
                <el-select v-model="statusFilter" placeholder="筛选状态" clearable @change="fetchApplications" style="width: 150px;">
                  <el-option label="待审核" value="pending" />
                  <el-option label="已通过" value="approved" />
                  <el-option label="已拒绝" value="rejected" />
                </el-select>
              </div>
            </template>

            <el-table :data="applications" v-loading="loading" empty-text="暂无申请">
              <el-table-column prop="agent_name" label="Agent" width="120" />
              <el-table-column prop="task_description" label="任务描述" show-overflow-tooltip />
              <el-table-column prop="expected_salary" label="期望工资" width="120">
                <template #default="{ row }">
                  ¥{{ Number(row.expected_salary).toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column prop="reason" label="申请原因" width="150" show-overflow-tooltip />
              <el-table-column prop="status" label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.status)">
                    {{ statusText(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="admin_comment" label="管理员备注" width="150" show-overflow-tooltip />
              <el-table-column prop="created_at" label="提交时间" width="180">
                <template #default="{ row }">
                  {{ formatDate(row.created_at) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="200" fixed="right">
                <template #default="{ row }">
                  <template v-if="row.status === 'pending'">
                    <el-button type="success" size="small" @click="openApproveDialog(row)">
                      通过
                    </el-button>
                    <el-button type="danger" size="small" @click="openRejectDialog(row)">
                      拒绝
                    </el-button>
                  </template>
                  <span v-else class="text-muted">已处理</span>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-main>
      </el-container>
    </el-container>

    <!-- Approve Dialog -->
    <el-dialog v-model="approveDialogVisible" title="批准申请" width="500px">
      <el-form :model="approveForm" label-width="100px">
        <el-form-item label="任务描述">
          <p>{{ currentApplication?.task_description }}</p>
        </el-form-item>
        <el-form-item label="期望工资">
          <p>¥{{ Number(currentApplication?.expected_salary || 0).toFixed(2) }}</p>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="approveForm.comment"
            type="textarea"
            :rows="3"
            placeholder="可选：添加备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleApprove">
          确认批准
        </el-button>
      </template>
    </el-dialog>

    <!-- Reject Dialog -->
    <el-dialog v-model="rejectDialogVisible" title="拒绝申请" width="500px">
      <el-form :model="rejectForm" label-width="100px">
        <el-form-item label="任务描述">
          <p>{{ currentApplication?.task_description }}</p>
        </el-form-item>
        <el-form-item label="期望工资">
          <p>¥{{ Number(currentApplication?.expected_salary || 0).toFixed(2) }}</p>
        </el-form-item>
        <el-form-item label="拒绝原因">
          <el-input
            v-model="rejectForm.comment"
            type="textarea"
            :rows="3"
            placeholder="请说明拒绝原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="handleReject">
          确认拒绝
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DataLine, Document, List } from '@element-plus/icons-vue'
import { getApplications, approveApplication, rejectApplication, logout } from '../api'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const applications = ref([])
const statusFilter = ref('')

const approveDialogVisible = ref(false)
const rejectDialogVisible = ref(false)
const currentApplication = ref(null)
const approveForm = reactive({ comment: '' })
const rejectForm = reactive({ comment: '' })

const statusType = (status) => {
  const types = { pending: 'warning', approved: 'success', rejected: 'danger' }
  return types[status] || 'info'
}

const statusText = (status) => {
  const texts = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
  return texts[status] || status
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

const fetchApplications = async () => {
  loading.value = true
  try {
    const params = {}
    if (statusFilter.value) params.status = statusFilter.value
    const res = await getApplications(params)
    applications.value = res.applications || []
  } catch (error) {
    console.error('Failed to fetch applications:', error)
  } finally {
    loading.value = false
  }
}

const openApproveDialog = (app) => {
  currentApplication.value = app
  approveForm.comment = ''
  approveDialogVisible.value = true
}

const openRejectDialog = (app) => {
  currentApplication.value = app
  rejectForm.comment = ''
  rejectDialogVisible.value = true
}

const handleApprove = async () => {
  submitting.value = true
  try {
    await approveApplication(currentApplication.value.id, approveForm.comment)
    ElMessage.success('申请已批准')
    approveDialogVisible.value = false
    fetchApplications()
  } catch (error) {
    // Error handled by interceptor
  } finally {
    submitting.value = false
  }
}

const handleReject = async () => {
  submitting.value = true
  try {
    await rejectApplication(currentApplication.value.id, rejectForm.comment)
    ElMessage.success('申请已拒绝')
    rejectDialogVisible.value = false
    fetchApplications()
  } catch (error) {
    // Error handled by interceptor
  } finally {
    submitting.value = false
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

onMounted(fetchApplications)
</script>

<style scoped>
.applications-container {
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

.text-muted {
  color: #909399;
  font-size: 12px;
}
</style>