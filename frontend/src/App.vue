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
  Papa.parse('../public/diapers.csv', {
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
        <q-toolbar-title>
          Tracker de precios de pañales
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page class="q-pa-md">
        <div class="row q-col-gutter-md">
          <div class="col-12">
            <q-card>
              <q-card-section>
                <div class="text-h6">Tendencia de precios (Por Unidad)</div>
              </q-card-section>
              <q-card-section style="height: 400px">
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
                <div class="text-h6">Log</div>
              </q-card-section>
              <q-card-section>
                <q-table
                  :rows="rows"
                  :columns="columns"
                  row-key="Date"
                  :pagination="{ rowsPerPage: 10 }"
                />
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
</style>
