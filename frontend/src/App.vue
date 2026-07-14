<script setup>
import { ref, onMounted, computed } from 'vue'
import Papa from 'papaparse'
import logoUrl from './assets/logo.png'
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

// Main raw rows from CSV
const rows = ref([])

// Dynamic list of products loaded from products.json
const productsList = ref([])

// Current active tab
const tab = ref('dashboard')

// Chart toggles and filters
const chartType = ref('diapers') // 'diapers' (unit price) or 'others' (total price)
const loaded = ref(false)
const systemLogs = ref('Cargando logs...')

// Google Sheets configuration state
const scriptUrl = ref(localStorage.getItem('diaper_stonks_script_url') || '')
const sheetCsvUrl = ref(localStorage.getItem('diaper_stonks_sheet_csv_url') || '')

// Modals and form state
const showAddModal = ref(false)
const showConfigModal = ref(false)
const newProductName = ref('')
const newProductUrl = ref('')
const newProductThreshold = ref('')
const submitting = ref(false)

// Save config handler
const saveConfig = () => {
  localStorage.setItem('diaper_stonks_script_url', scriptUrl.value)
  localStorage.setItem('diaper_stonks_sheet_csv_url', sheetCsvUrl.value)
  showConfigModal.value = false
  // Reload products in case CSV URL changed
  loadProducts()
}

// Columns for raw logs table
const rawColumns = [
  { name: 'date', label: 'Fecha', field: 'Fecha', sortable: true, align: 'left' },
  { name: 'product', label: 'Producto', field: 'Producto', sortable: true, align: 'left' },
  { name: 'count', label: 'Unidades', field: 'Numero de Pañales', sortable: true, align: 'right' },
  { name: 'price', label: 'Precio (€)', field: 'Precio', sortable: true, align: 'right' },
  { name: 'perUnit', label: 'Precio/Unidad (€)', field: 'Precio por unidad', sortable: true, align: 'right' }
]

// Fetch products list (from live Google Sheets CSV if configured, otherwise built-in products.json)
const loadProducts = () => {
  const urlToFetch = sheetCsvUrl.value || './products.json'
  
  if (urlToFetch.startsWith('http')) {
    // Parsing CSV from Google Sheets URL
    fetch(urlToFetch)
      .then(r => r.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          complete: (results) => {
            const list = results.data
              .filter(r => r.Nombre || r.Nombre === '')
              .map(r => ({
                name: r.Nombre,
                url: r.URL,
                threshold: parseFloat(r['Precio Alerta']) || null
              }))
            productsList.value = list
          },
          error: (err) => {
            console.error('Error parsing sheet CSV, falling back to local products.json:', err)
            loadLocalProducts()
          }
        })
      })
      .catch(err => {
        console.error('Error fetching sheet, falling back to local products.json:', err)
        loadLocalProducts()
      })
  } else {
    loadLocalProducts()
  }
}

const loadLocalProducts = () => {
  fetch('./products.json')
    .then(r => r.json())
    .then(data => {
      productsList.value = data
    })
    .catch(err => {
      console.error('Failed to load local products.json:', err)
      // Standard initial fallback
      productsList.value = [
        { name: 'Dodot talla 1', url: 'https://www.amazon.es/dp/B0976XNCQ5' },
        { name: 'Dodot talla 2', url: 'https://www.amazon.es/dp/B0DJBYVG1Q' },
        { name: 'Lillydoo talla 1', url: 'https://www.amazon.es/dp/B0F3P5TKJ1' },
        { name: 'Lillydoo talla 2', url: 'https://www.amazon.es/dp/B0F3P56XRH' },
        { name: 'Nido capazo bebe', url: 'https://www.amazon.es/dp/B0FNMS82XK' }
      ]
    })
}

// Fetch scraper logs
const loadLogs = () => {
  fetch('./diapers.txt')
    .then(r => r.text())
    .then(text => {
      systemLogs.value = text
    })
    .catch(() => {
      systemLogs.value = 'No se han encontrado registros de logs. El scraper se ejecutará pronto.'
    })
}

// Dynamic unique product list from raw rows
const uniqueProductsInLogs = computed(() => {
  const set = new Set()
  rows.value.forEach(row => {
    if (row.Producto) set.add(row.Producto)
  })
  return Array.from(set)
})

// Latest price details mapped by product
const latestPrices = computed(() => {
  const prices = {}
  rows.value.forEach(row => {
    if (!row.Producto) return
    prices[row.Producto] = {
      price: parseFloat(row.Precio),
      perUnit: parseFloat(row['Precio por unidad']),
      count: parseInt(row['Numero de Pañales'], 10),
      date: row.Fecha
    }
  })
  return prices
})

// KPIs calculations
const bestDiaperUnitPrice = computed(() => {
  let min = Infinity
  let name = ''
  Object.keys(latestPrices.value).forEach(productName => {
    const item = latestPrices.value[productName]
    if (item.count > 1 && item.perUnit < min) {
      min = item.perUnit
      name = productName
    }
  })
  return min === Infinity ? '-' : { price: min.toFixed(3), name }
})

const lastUpdateTime = computed(() => {
  if (rows.value.length === 0) return '-'
  return rows.value[rows.value.length - 1].Fecha
})

// Dynamic grouped columns for table
const dynamicGroupedColumns = computed(() => {
  const cols = [
    { name: 'date', label: 'Fecha', field: 'date', sortable: true, align: 'left' }
  ]
  
  // Find all products that are diapers (count > 1)
  const uniqueDiapers = new Set()
  rows.value.forEach(row => {
    if (row.Producto && parseInt(row['Numero de Pañales'], 10) > 1) {
      uniqueDiapers.add(row.Producto)
    }
  })

  Array.from(uniqueDiapers).forEach(prod => {
    cols.push({
      name: prod,
      label: prod,
      field: prod,
      sortable: false,
      align: 'right'
    })
  })

  return cols
})

// Dynamic grouped rows for table
const dynamicGroupedRows = computed(() => {
  const grouped = {}
  
  rows.value.forEach(row => {
    if (!row.Fecha || !row.Producto) return
    if (parseInt(row['Numero de Pañales'], 10) <= 1) return // Diapers only
    
    if (!grouped[row.Fecha]) {
      grouped[row.Fecha] = {
        date: row.Fecha
      }
    }
    grouped[row.Fecha][row.Producto] = parseFloat(row['Precio por unidad']).toFixed(3) + ' €'
  })

  return Object.values(grouped).reverse()
})

// Chart.js Data Generation
const chartData = computed(() => {
  const dates = new Set()
  const productData = {}

  rows.value.forEach(row => {
    if (!row.Fecha || !row.Producto) return
    
    const count = parseInt(row['Numero de Pañales'], 10)
    
    // Filter depending on selected chart type
    if (chartType.value === 'diapers' && count <= 1) return
    if (chartType.value === 'others' && count > 1) return
    
    dates.add(row.Fecha)
    
    if (!productData[row.Producto]) {
      productData[row.Producto] = []
    }
    
    const value = chartType.value === 'diapers' 
      ? parseFloat(row['Precio por unidad']) 
      : parseFloat(row.Precio)

    productData[row.Producto].push({
      x: row.Fecha,
      y: value
    })
  })

  const palette = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#64748b']
  
  const datasets = Object.keys(productData).map((product, index) => {
    const color = palette[index % palette.length]
    return {
      label: product,
      backgroundColor: color,
      borderColor: color,
      data: productData[product],
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6
    }
  })

  return {
    labels: Array.from(dates),
    datasets
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        font: {
          family: 'Inter',
          size: 11
        },
        boxWidth: 12
      }
    },
    tooltip: {
      padding: 12,
      titleFont: { family: 'Inter', weight: 'bold' },
      bodyFont: { family: 'Inter' },
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      grid: {
        color: '#f1f5f9'
      },
      ticks: {
        font: { family: 'Inter', size: 10 }
      }
    },
    y: {
      grid: {
        color: '#f1f5f9'
      },
      ticks: {
        font: { family: 'Inter', size: 10 },
        callback: function(value) {
          return value.toFixed(2) + ' €'
        }
      }
    }
  }
}

// Add new product handler
const addProduct = async () => {
  if (!scriptUrl.value) {
    alert('Por favor, configura la URL de tu Google Apps Script en los Ajustes (icono de engranaje arriba a la derecha).')
    showConfigModal.value = true
    return
  }
  if (!newProductName.value || !newProductUrl.value) {
    alert('El Nombre y el Enlace de Amazon son campos requeridos.')
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: newProductName.value,
      url: newProductUrl.value,
      threshold: parseFloat(newProductThreshold.value) || null
    }

    // Call web app with text/plain to bypass CORS preflights smoothly
    await fetch(scriptUrl.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify(payload)
    })

    // Reset fields
    newProductName.value = ''
    newProductUrl.value = ''
    newProductThreshold.value = ''
    showAddModal.value = false

    alert('✅ ¡Producto añadido con éxito!\n\nNota: La actualización de los precios se ejecutará automáticamente en las GitHub Actions de tu repositorio. En unos 3-5 minutos, el nuevo producto aparecerá con sus datos en la web.')
    
    // Refresh products view
    setTimeout(loadProducts, 2000)
  } catch (error) {
    console.error('Error inserting row in sheet:', error)
    alert('Error al conectar con Google Sheets: ' + error.message)
  } finally {
    submitting.value = false
  }
}

// Telegram credentials check helper
const telegramAlertTestText = ref('')
const testingTelegram = ref(false)
const testTelegramAlert = async () => {
  const token = localStorage.getItem('diaper_stonks_tg_token') || ''
  const chat_id = localStorage.getItem('diaper_stonks_tg_chat_id') || ''
  
  if (!token || !chat_id) {
    alert('Por favor, introduce el Token de Telegram y Chat ID para realizar el test.')
    return
  }
  
  testingTelegram.value = true
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat_id,
        text: '📈👶 <b>Diaper Stonks Test</b>\n\nLas notificaciones de Telegram están configuradas correctamente.',
        parse_mode: 'HTML'
      })
    })
    
    if (res.ok) {
      alert('¡Mensaje de prueba enviado con éxito!')
    } else {
      throw new Error(`Código de estado HTTP: ${res.status}`)
    }
  } catch (e) {
    alert('Error al enviar test de Telegram: ' + e.message)
  } finally {
    testingTelegram.value = false
  }
}

// Dialog helper for local credentials storage
const tgTokenInput = ref(localStorage.getItem('diaper_stonks_tg_token') || '')
const tgChatIdInput = ref(localStorage.getItem('diaper_stonks_tg_chat_id') || '')

const saveTelegramConfig = () => {
  localStorage.setItem('diaper_stonks_tg_token', tgTokenInput.value)
  localStorage.setItem('diaper_stonks_tg_chat_id', tgChatIdInput.value)
  alert('Configuración de Telegram guardada localmente.')
}

onMounted(() => {
  // Load products list
  loadProducts()
  
  // Parse CSV dataset
  Papa.parse('./diapers.csv', {
    download: true,
    header: true,
    complete: (results) => {
      console.log('Parsed CSV rows:', results.data)
      rows.value = results.data.filter(row => row.Fecha && row.Producto)
      loaded.value = true
    },
    error: (err) => {
      console.error('Error parsing diapers.csv:', err)
      loaded.value = true
    }
  })

  // Load logs file
  loadLogs()
})
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <!-- Clean SaaS Header -->
    <q-header class="bg-white text-slate-900 border-b border-slate-200">
      <div class="page-container q-py-sm flex justify-between items-center no-wrap">
        <div class="flex items-center gap-sm">
          <q-avatar size="42px" square>
            <img :src="logoUrl" alt="Diaper Stonks Logo" class="rounded-borders" />
          </q-avatar>
          <div>
            <div class="text-h6 text-weight-bold text-slate-900 flex items-center gap-xs">
              Diaper Stonks
              <q-badge color="indigo-6" outline label="v2.0" class="text-caption text-weight-medium" />
            </div>
            <div class="text-caption text-slate-500 text-weight-medium">Daily diaper price index tracker</div>
          </div>
        </div>

        <div class="flex items-center gap-sm">
          <q-btn
            round
            flat
            color="slate-7"
            icon="settings"
            @click="showConfigModal = true"
          >
            <q-tooltip font-family="Inter">Ajustes Base de Datos</q-tooltip>
          </q-btn>
          
          <q-btn
            color="indigo-6"
            icon="add"
            label="Añadir Producto"
            class="btn-primary"
            @click="showAddModal = true"
          />
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="border-t border-slate-100 flex justify-center">
        <q-tabs v-model="tab" no-caps class="text-slate-600 bg-white" active-color="indigo" indicator-color="indigo">
          <q-tab name="dashboard" label="Dashboard" icon="dashboard" />
          <q-tab name="products" label="Productos Rastreados" icon="list" />
          <q-tab name="log_raw" label="Log Completo (CSV)" icon="table_chart" />
        </q-tabs>
      </div>
    </q-header>

    <q-page-container>
      <q-page class="page-container q-pt-md">
        
        <!-- Tab Content -->
        <q-tab-panels v-model="tab" animated class="bg-transparent">
          
          <!-- TAB 1: DASHBOARD -->
          <q-tab-panel name="dashboard" class="q-pa-none">
            
            <!-- KPIs Card Grid -->
            <div class="row q-col-gutter-md q-mb-lg">
              <div class="col-12 col-sm-4">
                <q-card class="stonks-card q-pa-md flex items-center gap-md">
                  <q-avatar color="indigo-1" text-color="indigo-6" icon="trending_down" size="48px" />
                  <div>
                    <div class="text-caption text-slate-500 text-weight-medium text-uppercase">Mejor Ratio (€/Unidad)</div>
                    <div class="text-h6 text-weight-bold text-slate-900">
                      {{ typeof bestDiaperUnitPrice === 'object' ? bestDiaperUnitPrice.price + ' €' : '-' }}
                    </div>
                    <div class="text-caption text-slate-500 ellipsis" style="max-width: 220px">
                      {{ typeof bestDiaperUnitPrice === 'object' ? bestDiaperUnitPrice.name : 'N/A' }}
                    </div>
                  </div>
                </q-card>
              </div>

              <div class="col-12 col-sm-4">
                <q-card class="stonks-card q-pa-md flex items-center gap-md">
                  <q-avatar color="teal-1" text-color="teal-6" icon="inventory_2" size="48px" />
                  <div>
                    <div class="text-caption text-slate-500 text-weight-medium text-uppercase">Productos Activos</div>
                    <div class="text-h6 text-weight-bold text-slate-900">{{ productsList.length }}</div>
                    <div class="text-caption text-slate-500">Trackeados en Google Sheets</div>
                  </div>
                </q-card>
              </div>

              <div class="col-12 col-sm-4">
                <q-card class="stonks-card q-pa-md flex items-center gap-md">
                  <q-avatar color="amber-1" text-color="amber-6" icon="update" size="48px" />
                  <div>
                    <div class="text-caption text-slate-500 text-weight-medium text-uppercase">Última Actualización</div>
                    <div class="text-h6 text-weight-bold text-slate-900" style="font-size: 1.1rem">
                      {{ lastUpdateTime }}
                    </div>
                    <div class="text-caption text-slate-500">Programada vía GitHub Actions</div>
                  </div>
                </q-card>
              </div>
            </div>

            <!-- Main Chart Card -->
            <q-card class="stonks-card q-mb-lg">
              <q-card-section class="flex justify-between items-center q-pb-none">
                <div>
                  <div class="title-large">Tendencia de Precios Histórica</div>
                  <div class="text-caption text-slate-500">Precios actualizados automáticamente desde Amazon</div>
                </div>
                <div>
                  <q-btn-toggle
                    v-model="chartType"
                    no-caps
                    rounded
                    unelevated
                    toggle-color="indigo"
                    color="slate-1"
                    text-color="slate-7"
                    :options="[
                      { label: 'Pañales (€/unidad)', value: 'diapers' },
                      { label: 'Otros artículos (€/total)', value: 'others' }
                    ]"
                  />
                </div>
              </q-card-section>

              <q-card-section class="chart-section">
                <Line v-if="loaded && chartData.labels.length > 0" :data="chartData" :options="chartOptions" />
                <div v-else class="flex flex-center full-height">
                  <div class="text-center text-slate-400">
                    <q-spinner color="indigo" size="3em" class="q-mb-md" />
                    <div>Cargando series temporales del CSV...</div>
                  </div>
                </div>
              </q-card-section>
            </q-card>

            <!-- Grouped Prices Table -->
            <q-card class="stonks-card">
              <q-card-section>
                <div class="title-large">Tabla de Precios por Fecha</div>
                <div class="text-caption text-slate-500">Historial agrupado por fecha de muestreo (€ por unidad)</div>
              </q-card-section>
              <q-card-section class="q-pa-none">
                <q-table
                  :rows="dynamicGroupedRows"
                  :columns="dynamicGroupedColumns"
                  row-key="date"
                  flat
                  :pagination="{ rowsPerPage: 10 }"
                  no-data-label="Aún no hay datos para mostrar."
                />
              </q-card-section>
            </q-card>

          </q-tab-panel>

          <!-- TAB 2: TRACKED PRODUCTS -->
          <q-tab-panel name="products" class="q-pa-none">
            <div class="row items-center justify-between q-mb-md">
              <div>
                <div class="title-large">Productos bajo seguimiento</div>
                <div class="text-caption text-slate-500">Cargados en tiempo real desde tu base de datos de Google Sheets</div>
              </div>
              <q-btn
                color="indigo"
                icon="add"
                label="Añadir Producto"
                class="btn-primary"
                @click="showAddModal = true"
              />
            </div>

            <!-- Products grid -->
            <div class="row q-col-gutter-md">
              <div v-for="prod in productsList" :key="prod.url" class="col-12 col-sm-6 col-md-4">
                <q-card class="stonks-card q-pa-md flex flex-column justify-between full-height">
                  <div>
                    <div class="flex justify-between items-start no-wrap q-mb-sm">
                      <div class="text-subtitle1 text-weight-bold text-slate-900 ellipsis" style="max-width: 75%">
                        {{ prod.name }}
                      </div>
                      <q-badge color="indigo-1" text-color="indigo-7" class="q-py-xs q-px-sm">
                        {{ latestPrices[prod.name] ? latestPrices[prod.name].count + ' uds' : 'S/D' }}
                      </q-badge>
                    </div>

                    <!-- Price Details -->
                    <div class="q-mb-md">
                      <div v-if="latestPrices[prod.name]" class="flex items-baseline gap-xs">
                        <div class="text-h5 text-weight-bold text-slate-900">
                          {{ latestPrices[prod.name].price.toFixed(2) }}€
                        </div>
                        <div v-if="latestPrices[prod.name].count > 1" class="text-caption text-slate-500 text-weight-medium">
                          ({{ latestPrices[prod.name].perUnit.toFixed(3) }}€ / ud)
                        </div>
                      </div>
                      <div v-else class="text-caption text-amber-8 flex items-center gap-xs">
                        <q-icon name="pending" />
                        Pendiente del primer scrapeo automático
                      </div>
                    </div>

                    <!-- Details fields -->
                    <div class="q-py-sm border-t border-slate-100 flex justify-between text-caption text-slate-600">
                      <span>Límite Telegram:</span>
                      <span class="text-weight-bold text-slate-800">
                        {{ prod.threshold ? prod.threshold + '€' : 'Desactivado' }}
                      </span>
                    </div>
                  </div>

                  <div class="q-mt-md flex gap-sm no-wrap">
                    <q-btn
                      flat
                      color="indigo"
                      label="Ver en Amazon"
                      icon="open_in_new"
                      class="full-width text-caption"
                      no-caps
                      type="a"
                      :href="prod.url"
                      target="_blank"
                    />
                  </div>
                </q-card>
              </div>
            </div>
          </q-tab-panel>

          <!-- TAB 3: RAW CSV DATA -->
          <q-tab-panel name="log_raw" class="q-pa-none">
            <q-card class="stonks-card">
              <q-card-section>
                <div class="title-large">Historial Completo de Muestras</div>
                <div class="text-caption text-slate-500">Muestras de precios crudas del scraper (diapers.csv)</div>
              </q-card-section>
              <q-card-section class="q-pa-none">
                <q-table
                  :rows="rows"
                  :columns="rawColumns"
                  row-key="Fecha"
                  flat
                  :pagination="{ rowsPerPage: 15 }"
                  no-data-label="Cargando base de datos CSV..."
                />
              </q-card-section>
            </q-card>
          </q-tab-panel>

        </q-tab-panels>
      </q-page>
    </q-page-container>

    <!-- DIALOG: ADD PRODUCT -->
    <q-dialog v-model="showAddModal">
      <q-card style="width: 450px; max-width: 90vw;" class="q-pa-md">
        <q-card-section class="q-pb-none flex justify-between items-center">
          <div class="text-h6 text-weight-bold">Añadir Nuevo Producto</div>
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-py-md">
          <div class="q-gutter-md">
            <q-input
              v-model="newProductName"
              label="Nombre del Producto (ej: Dodot Talla 3)"
              outlined
              dense
              placeholder="Escribe un nombre identificativo"
            />
            
            <q-input
              v-model="newProductUrl"
              label="Enlace de Amazon (URL)"
              outlined
              dense
              placeholder="https://www.amazon.es/dp/..."
              type="url"
            />

            <q-input
              v-model="newProductThreshold"
              label="Precio Alerta Telegram (Opcional)"
              outlined
              dense
              type="number"
              step="0.01"
              placeholder="Envia notificacion si baja de este precio (€)"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pt-none">
          <q-btn label="Cancelar" flat color="slate-5" v-close-popup class="btn-secondary" />
          <q-btn
            label="Añadir Producto"
            color="indigo"
            class="btn-primary"
            @click="addProduct"
            :loading="submitting"
            :disable="!newProductName || !newProductUrl"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- DIALOG: CONFIGURATION -->
    <q-dialog v-model="showConfigModal">
      <q-card style="width: 500px; max-width: 90vw;" class="q-pa-md">
        <q-card-section class="q-pb-none flex justify-between items-center">
          <div class="text-h6 text-weight-bold">Ajustes de Integración</div>
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-py-md">
          <div class="text-caption text-slate-600 q-mb-md">
            Aquí puedes conectar la interfaz con tu Google Sheet para poder registrar productos. 
            Consulta el archivo <a href="file:///C:/Users/Kohsaka/.gemini/antigravity-ide/brain/286c879a-e924-45c4-9a35-3867ffd43d76/google_sheets_setup.md" target="_blank" class="text-indigo font-semibold">google_sheets_setup.md</a> para ver cómo obtener estos enlaces.
          </div>

          <div class="q-gutter-md">
            <!-- Google Web App API URL -->
            <q-input
              v-model="scriptUrl"
              label="Google Apps Script Web App URL"
              outlined
              dense
              placeholder="https://script.google.com/macros/s/.../exec"
              hint="URL generada al implementar como aplicación web (permite añadir productos)."
            />

            <!-- Google Sheets CSV URL -->
            <q-input
              v-model="sheetCsvUrl"
              label="Google Sheets CSV URL"
              outlined
              dense
              placeholder="https://docs.google.com/spreadsheets/d/.../gviz/tq?tqx=out:csv"
              hint="Enlace público de lectura en CSV (permite leer los productos en vivo)."
            />

            <div class="border-t border-slate-100 q-mt-md q-pt-md">
              <div class="text-subtitle2 text-weight-bold text-slate-800 q-mb-sm">Test Notificación Telegram</div>
              
              <div class="q-gutter-sm">
                <q-input
                  v-model="tgTokenInput"
                  label="TELEGRAM_TOKEN (Para Test)"
                  outlined
                  dense
                  type="password"
                />
                
                <q-input
                  v-model="tgChatIdInput"
                  label="TELEGRAM_CHAT_ID (Para Test)"
                  outlined
                  dense
                />
                
                <div class="flex justify-between items-center q-mt-sm">
                  <q-btn
                    label="Guardar Credenciales"
                    flat
                    dense
                    color="slate-7"
                    @click="saveTelegramConfig"
                    no-caps
                  />
                  
                  <q-btn
                    label="Enviar Mensaje Test"
                    flat
                    dense
                    color="indigo"
                    @click="testTelegramAlert"
                    :loading="testingTelegram"
                    no-caps
                  />
                </div>
              </div>
            </div>
            
            <!-- Hidden Logs for Admin debug -->
            <div class="border-t border-slate-100 q-mt-md q-pt-md">
              <div class="flex justify-between items-center q-mb-sm">
                <div class="text-subtitle2 text-weight-bold text-slate-800">Logs de Ejecución del Scraper</div>
                <q-btn
                  flat
                  dense
                  color="indigo"
                  icon="refresh"
                  label="Recargar"
                  @click="loadLogs"
                  no-caps
                  class="text-caption"
                />
              </div>
              <pre class="bg-slate-900 text-slate-100 q-pa-md rounded-borders text-caption text-left scroll" style="max-height: 180px; font-family: monospace; white-space: pre-wrap; margin: 0; overflow-y: auto;">{{ systemLogs }}</pre>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pt-none">
          <q-btn label="Cancelar" flat color="slate-5" v-close-popup class="btn-secondary" />
          <q-btn
            label="Guardar Cambios"
            color="indigo"
            class="btn-primary"
            @click="saveConfig"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-layout>
</template>
