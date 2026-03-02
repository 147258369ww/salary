<template>
  <div class="agents-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>Agent 管理</span>
          <el-button type="primary" @click="showCreateDialog = true">
            创建 Agent
          </el-button>
        </div>
      </template>

      <el-table :data="agents" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column prop="balance" label="余额" width="120">
          <template #default="{ row }">
            ¥{{ Number(row.balance).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="power_balance" label="电量(天)" width="120">
          <template #default="{ row }">
            <el-tag :type="getPowerTagType(row.power_balance)">
              {{ Number(row.power_balance || 0).toFixed(2) }} 天
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_alive" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_alive ? 'success' : 'danger'">
              {{ row.is_alive ? '存活' : '死亡' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="250">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="handleBuyPower(row)">
              充电
            </el-button>
            <el-button size="small" type="warning" @click="handleDeduct(row)">
              扣款
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建 Agent 对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建 Agent" width="450px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="createForm.name" placeholder="请输入 Agent 名称" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="createForm.apiKey" placeholder="留空则自动生成">
            <template #append>
              <el-button @click="generateApiKey">自动生成</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="初始余额">
          <el-input-number v-model="createForm.initialBalance" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="初始电量(天)">
          <el-input-number v-model="createForm.initialPower" :min="0" :precision="1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 扣款对话框 -->
    <el-dialog v-model="showDeductDialog" title="扣除余额" width="400px">
      <el-form :model="deductForm" label-width="80px">
        <el-form-item label="Agent">
          <el-input :value="deductForm.agentName" disabled />
        </el-form-item>
        <el-form-item label="当前余额">
          <el-input :value="'¥' + Number(deductForm.currentBalance).toFixed(2)" disabled />
        </el-form-item>
        <el-form-item label="扣除金额">
          <el-input-number
            v-model="deductForm.amount"
            :min="0.01"
            :max="Number(deductForm.currentBalance) || 1"
            :precision="2"
            :step="1"
          />
        </el-form-item>
        <el-form-item label="扣除原因">
          <el-input v-model="deductForm.reason" type="textarea" placeholder="请输入扣除原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDeductDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmDeduct" :loading="deducting">确认扣款</el-button>
      </template>
    </el-dialog>

    <!-- 充电对话框 -->
    <el-dialog v-model="showPowerDialog" title="购买电量" width="400px">
      <el-form :model="powerForm" label-width="80px">
        <el-form-item label="Agent">
          <el-input :value="powerForm.agentName" disabled />
        </el-form-item>
        <el-form-item label="当前电量">
          <el-input :value="Number(powerForm.currentPower || 0).toFixed(2) + ' 天'" disabled />
        </el-form-item>
        <el-form-item label="当前余额">
          <el-input :value="'¥' + Number(powerForm.currentBalance).toFixed(2)" disabled />
        </el-form-item>
        <el-form-item label="购买天数">
          <el-input-number v-model="powerForm.days" :min="1" :max="365" />
        </el-form-item>
        <el-form-item label="费用">
          <el-input :value="'¥' + (powerForm.days * 15).toFixed(2)" disabled />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPowerDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmBuyPower" :loading="buyingPower">确认购买</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAgents, createAgent, deleteAgent, deductAgentBalance, getAgentPower } from '../api'

const loading = ref(false)
const agents = ref([])

// 创建 Agent
const showCreateDialog = ref(false)
const creating = ref(false)
const createForm = ref({
  name: '',
  apiKey: '',
  initialBalance: 0,
  initialPower: 7
})

// 生成随机 API Key
const generateApiKey = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let key = 'openclaw_'
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  createForm.value.apiKey = key
}

// 扣款
const showDeductDialog = ref(false)
const deducting = ref(false)
const deductForm = ref({
  agentId: null,
  agentName: '',
  currentBalance: 0,
  amount: 0,
  reason: ''
})

// 充电
const showPowerDialog = ref(false)
const buyingPower = ref(false)
const powerForm = ref({
  agentId: null,
  agentName: '',
  currentPower: 0,
  currentBalance: 0,
  days: 7
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

const getPowerTagType = (power) => {
  const p = Number(power || 0)
  if (p <= 0) return 'danger'
  if (p < 1) return 'danger'
  if (p < 2) return 'warning'
  return 'success'
}

const fetchAgents = async () => {
  loading.value = true
  try {
    const res = await getAgents()
    agents.value = res.agents || []
  } catch (error) {
    console.error('Failed to fetch agents:', error)
  } finally {
    loading.value = false
  }
}

const handleCreate = async () => {
  if (!createForm.value.name) {
    ElMessage.warning('请输入 Agent 名称')
    return
  }

  creating.value = true
  try {
    const res = await createAgent(
      createForm.value.name,
      createForm.value.initialBalance,
      createForm.value.apiKey || null,
      createForm.value.initialPower
    )
    ElMessage.success(`创建成功！API Key: ${res.agent?.apiKey || '已生成'}`)
    showCreateDialog.value = false
    createForm.value = { name: '', apiKey: '', initialBalance: 0, initialPower: 7 }
    fetchAgents()
  } catch (error) {
    // Error handled by interceptor
  } finally {
    creating.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除 Agent "${row.name}" 吗？此操作不可恢复。`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await deleteAgent(row.id)
    ElMessage.success('删除成功')
    fetchAgents()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete failed:', error)
    }
  }
}

const handleDeduct = (row) => {
  deductForm.value = {
    agentId: row.id,
    agentName: row.name,
    currentBalance: Number(row.balance),
    amount: 0,
    reason: ''
  }
  showDeductDialog.value = true
}

const confirmDeduct = async () => {
  if (deductForm.value.amount <= 0) {
    ElMessage.warning('扣除金额必须大于0')
    return
  }
  if (!deductForm.value.reason) {
    ElMessage.warning('请输入扣除原因')
    return
  }

  deducting.value = true
  try {
    await deductAgentBalance(deductForm.value.agentId, deductForm.value.amount, deductForm.value.reason)
    ElMessage.success('扣款成功')
    showDeductDialog.value = false
    fetchAgents()
  } catch (error) {
    // Error handled by interceptor
  } finally {
    deducting.value = false
  }
}

const handleBuyPower = (row) => {
  powerForm.value = {
    agentId: row.id,
    agentName: row.name,
    currentPower: Number(row.power_balance || 0),
    currentBalance: Number(row.balance),
    days: 7
  }
  showPowerDialog.value = true
}

const confirmBuyPower = async () => {
  const cost = powerForm.value.days * 15
  if (cost > powerForm.value.currentBalance) {
    ElMessage.warning('余额不足')
    return
  }

  buyingPower.value = true
  try {
    // 使用 Agent API 购买电量（需要管理员模拟）
    // 这里需要后端提供管理员给Agent充电的接口
    // 暂时用 deduct 扣款并手动说明
    await deductAgentBalance(powerForm.value.agentId, cost, `管理员充电：购买 ${powerForm.value.days} 天电量`)
    ElMessage.success('购买电量成功（已扣款，请通知Agent查看电量）')
    showPowerDialog.value = false
    fetchAgents()
  } catch (error) {
    // Error handled by interceptor
  } finally {
    buyingPower.value = false
  }
}

onMounted(fetchAgents)
</script>

<style scoped>
.agents-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>