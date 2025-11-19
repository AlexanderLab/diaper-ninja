<script setup>
import { ref, onMounted, computed } from 'vue'
import Papa from 'papaparse'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

const columns = [
  { name: 'date', label: 'Fecha', field: 'Fecha', sortable: true, align: 'left' },
  { name: 'product', label: 'Producto', field: 'Producto', sortable: true, align: 'left' },
  { name: 'count', label: 'Número de Pañales', field: 'Numero de Pañales', sortable: true, align: 'right' },
  { name: 'price', label: 'Precio (€)', field: 'Precio', sortable: true, align: 'right' },
  { name: 'perUnit', label: 'Precio/Unidad (€)', field: 'Precio por unidad', sortable: true, align: 'right' }
]

const groupedColumns = [
  { name: 'date', label: 'Fecha', field: 'date', sortable: true, align: 'left' },
  { name: 'dodot1', label: 'Dodot T1', field: 'dodot1', sortable: false, align: 'right' },
  { name: 'dodot2', label: 'Dodot T2', field: 'dodot2', sortable: false, align: 'right' },
  { name: 'huggies1', label: 'Huggies T1', field: 'huggies1', sortable: false, align: 'right' },
  { name: 'lillydoo1', label: 'Lillydoo T1', field: 'lillydoo1', sortable: false, align: 'right' }
]

const rows = ref([])
const groupedRows = ref([])
const tab = ref('overview')
const chartData = ref({
  labels: [],
  datasets: []
})
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false
}
const loaded = ref(false)

const processGroupedData = (data) => {
  const grouped = {}
  
  data.forEach(row => {
    if (!row.Fecha || !row.Producto) return
    
    if (!grouped[row.Fecha]) {
      grouped[row.Fecha] = {
        date: row.Fecha,
        dodot1: '-',
        dodot2: '-',
        huggies1: '-',
        lillydoo1: '-'
      }
    }
    
    const pricePerUnit = row['Precio por unidad']
    if (row.Producto === 'Dodot talla 1') {
      grouped[row.Fecha].dodot1 = pricePerUnit
    } else if (row.Producto === 'Dodot talla 2') {
      grouped[row.Fecha].dodot2 = pricePerUnit
    } else if (row.Producto === 'Huggies talla 1') {
      grouped[row.Fecha].huggies1 = pricePerUnit
    } else if (row.Producto === 'Lillydoo talla 1') {
      grouped[row.Fecha].lillydoo1 = pricePerUnit
    }
  })
  
  groupedRows.value = Object.values(grouped).reverse()
}

const processChartData = (data) => {
  // Group by product
  const products = {}
  const dates = new Set()

  data.forEach(row => {
    if (!row.Fecha || !row.Producto) return
    
    dates.add(row.Fecha)
    
    if (!products[row.Producto]) {
      products[row.Producto] = []
    }
    products[row.Producto].push({
      x: row.Fecha,
      y: parseFloat(row['Precio por unidad'])
    })
  })

  const datasets = Object.keys(products).map((product, index) => {
    const colors = ['#1976D2', '#26A69A', '#9C27B0', '#F2C037', '#C10015']
    return {
      label: product,
      backgroundColor: colors[index % colors.length],
      borderColor: colors[index % colors.length],
      data: products[product],
      tension: 0.1
    }
  })

  chartData.value = {
    labels: Array.from(dates),
    datasets
  }
  loaded.value = true
}

onMounted(() => {
  Papa.parse('./diapers.csv', {
    download: true,
    header: true,
    complete: (results) => {
      console.log('Parsed CSV:', results.data)
      const filteredData = results.data.filter(row => row.Fecha && row.Producto)
      rows.value = filteredData
      processChartData(filteredData)
      processGroupedData(filteredData)
    },
    error: (err) => {
      console.error('Error parsing CSV:', err)
    }
  })
})
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-toolbar-title class="text-center text-sm-left">
          <div class="text-h6">Tracker de precios de pañales</div>
        </q-toolbar-title>
      </q-toolbar>
      
      <q-tabs v-model="tab" align="center" class="bg-primary">
        <q-tab name="overview" label="Charts" />
        <q-tab name="log" label="Log" />
      </q-tabs>
    </q-header>

    <q-page-container>
      <q-page class="page-content">
        <q-tab-panels v-model="tab" animated class="bg-transparent">
          <!-- Overview Tab -->
          <q-tab-panel name="overview" class="q-pa-sm q-pa-md-md">
            <div class="row q-col-gutter-sm q-col-gutter-md-md">
              <!-- Chart -->
              <div class="col-12">
                <q-card>
                  <q-card-section>
                    <div class="text-h6 text-body1-sm">Tendencia de precios (Por Unidad)</div>
                  </q-card-section>
                  <q-card-section class="chart-section">
                    <Line v-if="loaded" :data="chartData" :options="chartOptions" />
                    <div v-else class="flex flex-center full-height">
                      <q-spinner color="primary" size="3em" />
                    </div>
                  </q-card-section>
                </q-card>
              </div>

              <!-- Grouped Table -->
              <div class="col-12">
                <q-card>
                  <q-card-section>
                    <div class="text-h6 text-body1-sm">Precios por fecha (€/unidad)</div>
                  </q-card-section>
                  <q-card-section class="q-pa-none q-pa-sm-sm">
                    <q-table
                      :rows="groupedRows"
                      :columns="groupedColumns"
                      row-key="date"
                      :pagination="{ rowsPerPage: 10 }"
                      :dense="$q.screen.lt.md"
                      flat
                      bordered
                    >
                      <template v-slot:body-cell="props">
                        <q-td :props="props" class="text-caption text-body2-sm">
                          {{ props.value }}
                        </q-td>
                      </template>
                    </q-table>
                  </q-card-section>
                </q-card>
              </div>
            </div>
          </q-tab-panel>

          <!-- Log Tab -->
          <q-tab-panel name="log" class="q-pa-sm q-pa-md-md">
            <q-card>
              <q-card-section>
                <div class="text-h6 text-body1-sm">Log Completo</div>
              </q-card-section>
              <q-card-section class="q-pa-none q-pa-sm-sm">
                <q-table
                  :rows="rows"
                  :columns="columns"
                  row-key="Date"
                  :pagination="{ rowsPerPage: 20 }"
                  :dense="$q.screen.lt.md"
                  :grid="$q.screen.xs"
                >
                  <template v-slot:body-cell="props">
                    <q-td :props="props" class="text-caption text-body2-sm">
                      {{ props.value }}
                    </q-td>
                  </template>
                </q-table>
              </q-card-section>
            </q-card>
          </q-tab-panel>
        </q-tab-panels>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<style>
html,
body {
  background-color: #ffffff !important;
}

.q-layout,
.q-page-container,
.q-page {
  background-color: #ffffff !important;
}

.page-content {
  background-color: #ffffff !important;
  min-height: 100vh;
}

.q-tab-panels,
.q-tab-panel {
  background-color: #ffffff !important;
}

.q-card {
  background-color: #ffffff !important;
}

.q-card-section {
  background-color: #ffffff !important;
}

.chart-section {
  height: 250px;
  padding: 8px;
  background-color: #ffffff !important;
}

@media (min-width: 600px) {
  .chart-section {
    height: 400px;
    padding: 16px;
  }
}

@media (max-width: 599px) {
  .text-h6 {
    font-size: 1.1rem !important;
  }
  
  .q-table th,
  .q-table td {
    font-size: 0.75rem !important;
    padding: 4px 8px !important;
  }
}
</style>
