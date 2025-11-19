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

const rows = ref([])
const chartData = ref({
  labels: [],
  datasets: []
})
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false
}
const loaded = ref(false)

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
      rows.value = results.data.filter(row => row.Fecha && row.Producto) // Filter empty rows
      processChartData(rows.value)
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
    </q-header>

    <q-page-container>
      <q-page class="q-pa-sm q-pa-md-md">
        <div class="row q-col-gutter-sm q-col-gutter-md-md">
          <div class="col-12">
            <q-card>
              <q-card-section>
                <div class="text-h6 text-body1-sm">Tendencia de precios (Por Unidad)</div>
              </q-card-section>
              <q-card-section style="height: 300px" class="chart-section">
                <Line v-if="loaded" :data="chartData" :options="chartOptions" />
                <div v-else class="flex flex-center full-height">
                  <q-spinner color="primary" size="3em" />
                </div>
              </q-card-section>
            </q-card>
          </div>

          <div class="col-12">
            <q-card>
              <q-card-section>
                <div class="text-h6 text-body1-sm">Log</div>
              </q-card-section>
              <q-card-section class="q-pa-none q-pa-sm-sm">
                <q-table
                  :rows="rows"
                  :columns="columns"
                  row-key="Date"
                  :pagination="{ rowsPerPage: 10 }"
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
          </div>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<style>
body {
  background-color: #f5f5f5;
}

.chart-section {
  height: 300px;
}

@media (min-width: 600px) {
  .chart-section {
    height: 400px;
  }
}

@media (max-width: 599px) {
  .text-h6 {
    font-size: 1.1rem !important;
  }
}
</style>
