import.meta.env.VITE_FIREBASE_API_KEY

// Variables globales
let currentSaleItems = [];
let editingProductId = null;
let editingClientId = null;
let currentSaleId = null;
// Variables globales para pagos parciales
let selectedPaymentMethod = 'efectivo';
let isPartialPayment = false;
let selectedProducts = [];

// Configuración de la API RENIEC
const API_CONFIG = {
    baseUrl: 'https://apiperu.dev/api',
    token: '3a451e42f184f40438d77992c710b41f39de11872984aebf33058276a75a46c6'
};

// CONFIGURACIÓN FIREBASE
const configuracionFirebase = {
    claveAPI: import.meta.env.VITE_FIREBASE_API_KEY,
    dominioAutenticacion: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    urlBaseDatos: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    idProyecto: import.meta.env.VITE_FIREBASE_PROJECT_ID
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// === FUNCIONES FIREBASE ===
function getProducts() {
    return new Promise((resolve) => {
        database.ref('products').once('value', (snapshot) => {
            const data = snapshot.val();
            resolve(data ? Object.values(data) : []);
        });
    });
}

function saveProducts(products) {
    return database.ref('products').set(products);
}

function getClients() {
    return new Promise((resolve) => {
        database.ref('clients').once('value', (snapshot) => {
            const data = snapshot.val();
            resolve(data ? Object.values(data) : []);
        });
    });
}

function saveClients(clients) {
    return database.ref('clients').set(clients);
}

function getSales() {
    return new Promise((resolve) => {
        database.ref('sales').once('value', (snapshot) => {
            const data = snapshot.val();
            resolve(data ? Object.values(data) : []);
        });
    });
}

function saveSales(sales) {
    return database.ref('sales').set(sales);
}

// === FUNCIONES DE PAGOS PARCIALES ===
function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    
    console.log('Método seleccionado:', method);
    
    // Remover selección anterior
    document.querySelectorAll('.payment-method').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Agregar selección actual
    const methodElement = document.querySelector(`[data-method="${method}"]`);
    if (methodElement) {
        methodElement.classList.add('selected');
    }
}

function setupPaymentMethodListeners() {
    // Remover listeners existentes primero
    document.querySelectorAll('.payment-method').forEach(method => {
        const newMethod = method.cloneNode(true);
        method.parentNode.replaceChild(newMethod, method);
    });
    
    // Agregar nuevos listeners
    document.querySelectorAll('.payment-method').forEach(method => {
        method.addEventListener('click', function() {
            const methodType = this.getAttribute('data-method');
            selectPaymentMethod(methodType);
        });
    });
}

function initializePaymentMethods() {
    // Seleccionar "efectivo" por defecto
    selectPaymentMethod('efectivo');
    
    // Configurar listeners
    setupPaymentMethodListeners();
}

function togglePartialPayment() {
    isPartialPayment = document.getElementById('partial-payment-checkbox').checked;
    const partialSection = document.getElementById('partial-payment-section');
    const normalSection = document.getElementById('normal-payment-section');
    
    if (isPartialPayment) {
        partialSection.classList.remove('hidden');
        normalSection.classList.add('hidden');
        updateProductSelectionList();
    } else {
        partialSection.classList.add('hidden');
        normalSection.classList.remove('hidden');
    }
    
    updatePaymentCalculations();
}

function updateProductSelectionList() {
    const container = document.getElementById('product-selection-list');
    container.innerHTML = '';
    
    if (currentSaleItems.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay productos en la venta</p>';
        return;
    }
    
    currentSaleItems.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        const checkbox = document.createElement('div');
        checkbox.className = 'product-checkbox';
        checkbox.innerHTML = `
            <input type="checkbox" id="product-${index}" onchange="updateSelectedProducts(${index})" checked>
            <label for="product-${index}" style="flex: 1;">
                <strong>${item.name}</strong> - ${item.quantity} x S/${item.price.toFixed(2)} = S/${itemTotal.toFixed(2)}
            </label>
        `;
        container.appendChild(checkbox);
    });
    
    // Inicializar todos los productos como seleccionados
    selectedProducts = currentSaleItems.map((item, index) => index);
    updateSelectedTotal();
}

function updateSelectedProducts(index) {
    const checkbox = document.getElementById(`product-${index}`);
    
    if (checkbox.checked) {
        if (!selectedProducts.includes(index)) {
            selectedProducts.push(index);
        }
    } else {
        selectedProducts = selectedProducts.filter(i => i !== index);
    }
    
    updateSelectedTotal();
}

function updateSelectedTotal() {
    let selectedTotal = 0;
    
    selectedProducts.forEach(index => {
        const item = currentSaleItems[index];
        selectedTotal += item.price * item.quantity;
    });
    
    document.getElementById('selected-total').textContent = selectedTotal.toFixed(2);
    document.getElementById('payment-amount').value = selectedTotal.toFixed(2);
    calculateRemaining();
}

function calculateRemaining() {
    const selectedTotalText = document.getElementById('selected-total').textContent;
    const paymentAmountInput = document.getElementById('payment-amount').value;
    
    const selectedTotal = parseFloat(selectedTotalText) || 0;
    const paymentAmount = parseFloat(paymentAmountInput) || 0;
    
    console.log('Calculando saldo pendiente:', { selectedTotal, paymentAmount });
    
    const change = Math.max(0, paymentAmount - selectedTotal);
    const pending = Math.max(0, selectedTotal - paymentAmount);
    
    document.getElementById('entered-amount').textContent = paymentAmount.toFixed(2);
    document.getElementById('change-amount').textContent = change.toFixed(2);
    document.getElementById('pending-amount').textContent = pending.toFixed(2);
}

function calculateChange() {
    const totalText = document.getElementById('sale-total').textContent;
    const amountReceivedInput = document.getElementById('amount-received').value;
    
    const total = parseFloat(totalText) || 0;
    const amountReceived = parseFloat(amountReceivedInput) || 0;
    
    console.log('Calculando cambio:', { total, amountReceived });
    
    const change = Math.max(0, amountReceived - total);
    document.getElementById('normal-change').textContent = change.toFixed(2);
}

function updatePaymentCalculations() {
    if (isPartialPayment) {
        calculateRemaining();
    } else {
        calculateChange();
    }
}

// === FUNCIÓN COMPLETA DE VENTA CON ADELANTOS/SEPARACIONES ===
function calculateChange() {
    const totalText = document.getElementById('sale-total').textContent;
    const amountReceivedInput = document.getElementById('amount-received').value;
    
    const total = parseFloat(totalText) || 0;
    const amountReceived = parseFloat(amountReceivedInput) || 0;
    
    console.log('Calculando cambio:', { total, amountReceived });
    
    const change = Math.max(0, amountReceived - total);
    document.getElementById('normal-change').textContent = change.toFixed(2);
    
    // El campo "monto recibido" es opcional para pagos completos
    // Si está vacío, no mostrar cambio
    if (amountReceivedInput === '') {
        document.getElementById('normal-change').textContent = '0.00';
    }
}


// === ACTUALIZACIÓN EN TIEMPO REAL ===
function setupRealtimeUpdates() {
    database.ref('products').on('value', () => {
        loadProductsTable();
        populateSaleSelects();
        updateDashboardStats();
    });
    
    database.ref('clients').on('value', () => {
        loadClientsTable();
        populateSaleSelects();
        updateDashboardStats();
    });
    
    database.ref('sales').on('value', () => {
        loadSalesHistory();
        loadRecentSales();
        updateDashboardStats();
    });
}
// Función para limpiar y validar inputs numéricos
function setupNumericInputs() {
    // Para el monto recibido en ventas normales
    const amountReceivedInput = document.getElementById('amount-received');
    if (amountReceivedInput) {
        amountReceivedInput.addEventListener('input', function(e) {
            // Permitir solo números y punto decimal
            e.target.value = e.target.value.replace(/[^0-9.]/g, '');
            
            // Remover puntos decimales extras
            const parts = e.target.value.split('.');
            if (parts.length > 2) {
                e.target.value = parts[0] + '.' + parts.slice(1).join('');
            }
        });
    }

    // Para el monto de pago en ventas parciales
    const paymentAmountInput = document.getElementById('payment-amount');
    if (paymentAmountInput) {
        paymentAmountInput.addEventListener('input', function(e) {
            // Permitir solo números y punto decimal
            e.target.value = e.target.value.replace(/[^0-9.]/g, '');
            
            // Remover puntos decimales extras
            const parts = e.target.value.split('.');
            if (parts.length > 2) {
                e.target.value = parts[0] + '.' + parts.slice(1).join('');
            }
        });
    }

    // Para la cantidad en ventas
    const saleQuantityInput = document.getElementById('sale-quantity');
    if (saleQuantityInput) {
        saleQuantityInput.addEventListener('input', function(e) {
            // Permitir solo números
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando sistema...');
    
    // Secuencia de inicialización
    initializeSystem().then(() => {
        setupNavigation();
        setupEventListeners();
        setupRealtimeUpdates();
        setupMobileMenu();
        initializePaymentMethods();
        setupNumericInputs(); // ← AGREGAR ESTA LÍNEA
        
        // Cargar datos iniciales
        return loadInitialData();
    }).then(() => {
        console.log('✅ Sistema inicializado correctamente');
        
        // Forzar actualización del dashboard
        setTimeout(() => {
            updateDashboardStats();
        }, 500);
    }).catch(error => {
        console.error('❌ Error inicializando sistema:', error);
        showAlert('Error al inicializar el sistema: ' + error.message, 'error');
    });
});

async function initializeSystem() {
    try {
        const products = await getProducts();
        const clients = await getClients();
        const sales = await getSales();
        
        if (products.length === 0 && clients.length === 0) {
            const initialData = {
                products: [
                    { id: 1, name: "Laptop HP 15\"", category: "Electrónicos", price: 450.00, cost: 350.00, stock: 12, minStock: 5, description: "Laptop HP" },
                    { id: 2, name: "Mouse Inalámbrico", category: "Electrónicos", price: 25.50, cost: 15.00, stock: 3, minStock: 10, description: "Mouse ergonómico" },
                    { id: 3, name: "Teclado Mecánico", category: "Electrónicos", price: 75.00, cost: 45.00, stock: 5, minStock: 8, description: "Teclado gaming" }
                ],
                clients: [
                    { id: 1, dni: "12345678", name: "Juan Pérez", email: "juan@example.com", phone: "555-1234", address: "Calle Principal 123", type: "regular" },
                    { id: 2, dni: "87654321", name: "María García", email: "maria@example.com", phone: "555-5678", address: "Av. Central 456", type: "premium" }
                ],
                sales: []
            };
            
            await saveProducts(initialData.products);
            await saveClients(initialData.clients);
            await saveSales(initialData.sales);
            
            showAlert('Sistema inicializado con datos de ejemplo', 'success');
        } else {
            showAlert('Sistema cargado correctamente desde Firebase', 'success');
        }
    } catch (error) {
        console.error('Error inicializando sistema:', error);
        showAlert('Error al cargar el sistema: ' + error.message, 'error');
    }
}

// === NAVEGACIÓN ===
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            document.querySelector('.page-title h1').textContent = this.querySelector('span').textContent;
        });
    });
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    // Productos
    document.getElementById('add-product-btn').addEventListener('click', showProductForm);
    document.querySelector('#product-modal .close-modal').addEventListener('click', hideProductForm);
    document.getElementById('cancel-product-btn').addEventListener('click', hideProductForm);
    document.getElementById('save-product-btn').addEventListener('click', saveProduct);

    // Clientes
    document.getElementById('add-client-btn').addEventListener('click', showClientForm);
    document.querySelector('#client-modal .close-modal').addEventListener('click', hideClientForm);
    document.getElementById('cancel-client-btn').addEventListener('click', hideClientForm);
    document.getElementById('save-client-btn').addEventListener('click', saveClient);
    
    // API RENIEC
    document.getElementById('search-dni-btn').addEventListener('click', searchDNI);
    setupDNIValidation();

    // Ventas
    document.getElementById('add-to-sale-btn').addEventListener('click', addProductToSale);
    document.getElementById('clear-sale').addEventListener('click', clearCurrentSale);

    // Reportes
    document.getElementById('report-form').addEventListener('submit', function(e) {
        e.preventDefault();
        generateReport();
    });

    // Cerrar modales
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// === FUNCIONES DE CARGA DE DATOS ===
async function loadInitialData() {
    console.log('📊 Cargando datos iniciales...');
    
    try {
        await loadProductsTable();
        await loadClientsTable();
        await loadSalesHistory();
        await populateSaleSelects();
        await loadRecentSales();
        await updateDashboardStats();
        
        console.log('✅ Datos iniciales cargados');
    } catch (error) {
        console.error('❌ Error cargando datos iniciales:', error);
        throw error;
    }
}

// === FUNCIONES DE PRODUCTOS ===
async function loadProductsTable() {
    const products = await getProducts();
    const tbody = document.getElementById('products-table-body');
    tbody.innerHTML = '';
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-box-open"></i><p>No hay productos</p></td></tr>';
        return;
    }
    
    products.forEach(product => {
        const statusClass = product.stock === 0 ? 'badge-danger' : 
                          product.stock <= product.minStock ? 'badge-warning' : 'badge-success';
        const statusText = product.stock === 0 ? 'Sin Stock' : 
                         product.stock <= product.minStock ? 'Bajo' : 'Disponible';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>${product.price.toFixed(2)}</td>
            <td>${product.stock}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct(${product.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function saveProduct() {
    const products = await getProducts();
    const name = document.getElementById('product-name').value.trim();
    const category = document.getElementById('product-category').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const stock = parseInt(document.getElementById('product-stock').value);
    const cost = parseFloat(document.getElementById('product-cost').value) || 0;
    const minStock = parseInt(document.getElementById('product-min-stock').value);
    const description = document.getElementById('product-description').value.trim();
    
    if (!name) {
        showAlert('El nombre del producto es obligatorio', 'error');
        return;
    }
    
    if (price <= 0) {
        showAlert('El precio debe ser mayor a 0', 'error');
        return;
    }
    
    if (stock < 0) {
        showAlert('El stock no puede ser negativo', 'error');
        return;
    }
    
    if (editingProductId) {
        const index = products.findIndex(p => p.id === editingProductId);
        products[index] = { ...products[index], name, category, price, stock, cost, minStock, description };
    } else {
        const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
        products.push({ id: newId, name, category, price, stock, cost, minStock, description });
    }
    
    await saveProducts(products);
    hideProductForm();
    showAlert('Producto guardado correctamente', 'success');
    
    // Actualizar dashboard
    setTimeout(() => {
        updateDashboardStats();
    }, 500);
}

async function editProduct(id) {
    const products = await getProducts();
    const product = products.find(p => p.id === id);
    if (product) {
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-stock').value = product.stock;
        document.getElementById('product-cost').value = product.cost;
        document.getElementById('product-min-stock').value = product.minStock;
        document.getElementById('product-description').value = product.description;
        document.getElementById('product-form-title').textContent = 'Editar Producto';
        document.getElementById('product-modal').style.display = 'flex';
        editingProductId = id;
    }
}

async function deleteProduct(id) {
    const products = await getProducts();
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    if (confirm(`¿Está seguro de eliminar el producto "${product.name}"?`)) {
        const updatedProducts = products.filter(p => p.id !== id);
        await saveProducts(updatedProducts);
        showAlert('Producto eliminado correctamente', 'success');
        
        // Actualizar dashboard
        setTimeout(() => {
            updateDashboardStats();
        }, 500);
    }
}

// === FUNCIONES DE CLIENTES ===
async function loadClientsTable() {
    const clients = await getClients();
    const tbody = document.getElementById('clients-table-body');
    tbody.innerHTML = '';
    
    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-users"></i><p>No hay clientes</p></td></tr>';
        return;
    }
    
    clients.forEach(client => {
        const typeClass = client.type === 'premium' ? 'badge-success' : 'badge-primary';
        const typeText = client.type === 'premium' ? 'Premium' : 'Regular';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${client.id}</td>
            <td>${client.dni || 'N/A'}</td>
            <td>${client.name}</td>
            <td>${client.email}</td>
            <td>${client.phone}</td>
            <td>
                <span class="badge ${typeClass}">${typeText}</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="editClient(${client.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteClient(${client.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function saveClient() {
    const clients = await getClients();
    const dni = document.getElementById('client-dni').value.trim();
    const name = document.getElementById('client-name').value.trim();
    const email = document.getElementById('client-email').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const address = document.getElementById('client-address').value.trim();
    const type = document.getElementById('client-type').value;
    
    if (!dni || dni.length !== 8) {
        showAlert('Ingrese un DNI válido de 8 dígitos', 'error');
        return;
    }
    
    if (!name) {
        showAlert('El nombre es obligatorio', 'error');
        document.getElementById('client-name').focus();
        return;
    }
    
    if (!editingClientId) {
        const existingClient = clients.find(c => c.dni === dni);
        if (existingClient) {
            showAlert('Ya existe un cliente con este DNI', 'error');
            return;
        }
    }
    
    if (email && !isValidEmail(email)) {
        showAlert('Ingrese un email válido', 'error');
        document.getElementById('client-email').focus();
        return;
    }
    
    if (editingClientId) {
        const index = clients.findIndex(c => c.id === editingClientId);
        clients[index] = { ...clients[index], dni, name, email, phone, address, type };
    } else {
        const newId = clients.length > 0 ? Math.max(...clients.map(c => c.id)) + 1 : 1;
        clients.push({ id: newId, dni, name, email, phone, address, type });
    }
    
    await saveClients(clients);
    hideClientForm();
    showAlert('Cliente guardado correctamente', 'success');
    
    // Actualizar dashboard
    setTimeout(() => {
        updateDashboardStats();
    }, 500);
}

async function editClient(id) {
    const clients = await getClients();
    const client = clients.find(c => c.id === id);
    if (client) {
        document.getElementById('client-dni').value = client.dni || '';
        document.getElementById('client-name').value = client.name;
        document.getElementById('client-name').removeAttribute('readonly');
        document.getElementById('client-email').value = client.email;
        document.getElementById('client-phone').value = client.phone;
        document.getElementById('client-address').value = client.address;
        document.getElementById('client-type').value = client.type;
        document.getElementById('client-form-title').textContent = 'Editar Cliente';
        document.getElementById('client-modal').style.display = 'flex';
        editingClientId = id;
    }
}

async function deleteClient(id) {
    const clients = await getClients();
    const sales = await getSales();
    const client = clients.find(c => c.id === id);
    if (!client) return;
    
    const clientSales = sales.filter(s => s.clientId === id);
    if (clientSales.length > 0) {
        showAlert('No se puede eliminar el cliente porque tiene ventas asociadas', 'error');
        return;
    }
    
    if (confirm(`¿Está seguro de eliminar al cliente "${client.name}"?`)) {
        const updatedClients = clients.filter(c => c.id !== id);
        await saveClients(updatedClients);
        showAlert('Cliente eliminado correctamente', 'success');
        
        // Actualizar dashboard
        setTimeout(() => {
            updateDashboardStats();
        }, 500);
    }
}

// === FUNCIONES DE VENTAS ===
async function populateSaleSelects() {
    const clients = await getClients();
    const products = await getProducts();
    
    const clientSelect = document.getElementById('sale-client');
    const productSelect = document.getElementById('sale-product');
    
    clientSelect.innerHTML = '<option value="">Seleccione un cliente</option>';
    productSelect.innerHTML = '<option value="">Seleccione un producto</option>';
    
    clients.forEach(client => {
        clientSelect.innerHTML += `<option value="${client.id}">${client.name} - ${client.dni}</option>`;
    });
    
    products.filter(p => p.stock > 0).forEach(product => {
        productSelect.innerHTML += `<option value="${product.id}">${product.name} - S/${product.price.toFixed(2)} (Stock: ${product.stock})</option>`;
    });
}

async function addProductToSale() {
    const productId = parseInt(document.getElementById('sale-product').value);
    const quantity = parseInt(document.getElementById('sale-quantity').value);
    
    if (!productId || quantity <= 0) {
        showAlert('Seleccione un producto y cantidad válida', 'error');
        return;
    }
    
    const products = await getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) {
        showAlert('Producto no encontrado', 'error');
        return;
    }
    
    if (product.stock < quantity) {
        showAlert(`Stock insuficiente. Solo hay ${product.stock} unidades disponibles`, 'error');
        return;
    }
    
    const existingIndex = currentSaleItems.findIndex(item => item.productId === productId);
    if (existingIndex !== -1) {
        const newQuantity = currentSaleItems[existingIndex].quantity + quantity;
        if (newQuantity > product.stock) {
            showAlert(`No hay suficiente stock. Máximo disponible: ${product.stock} unidades`, 'error');
            return;
        }
        currentSaleItems[existingIndex].quantity = newQuantity;
    } else {
        currentSaleItems.push({
            productId,
            name: product.name,
            price: product.price,
            quantity
        });
    }
    
    updateSaleItemsTable();
    document.getElementById('sale-quantity').value = 1;
    showAlert('Producto agregado a la venta', 'success');
}

function updateSaleItemsTable() {
    const tbody = document.getElementById('sale-items-body');
    tbody.innerHTML = '';
    
    let subtotal = 0;
    currentSaleItems.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>S/${item.price.toFixed(2)}</td>
            <td>
                <div class="cart-item-quantity">
                    <button class="quantity-btn" onclick="updateSaleQuantity(${index}, -1)">-</button>
                    <input type="number" class="quantity-input" value="${item.quantity}" min="1" 
                           onchange="updateSaleQuantityInput(${index}, this.value)">
                    <button class="quantity-btn" onclick="updateSaleQuantity(${index}, 1)">+</button>
                </div>
            </td>
            <td>S/${itemTotal.toFixed(2)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="removeFromSale(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    const total = subtotal;
    
    document.getElementById('sale-subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('sale-igv').textContent = '0.00';
    document.getElementById('sale-total').textContent = total.toFixed(2);
    
    // Actualizar cálculos de pago
    updatePaymentCalculations();
}

async function updateSaleQuantity(index, change) {
    const products = await getProducts();
    const product = products.find(p => p.id === currentSaleItems[index].productId);
    
    const newQuantity = currentSaleItems[index].quantity + change;
    
    if (newQuantity < 1) {
        removeFromSale(index);
        return;
    }
    
    // Validar stock disponible
    if (product && newQuantity > product.stock) {
        showAlert(`No hay suficiente stock. Máximo disponible: ${product.stock} unidades`, 'error');
        return;
    }
    
    currentSaleItems[index].quantity = newQuantity;
    updateSaleItemsTable();
}

function updateSaleQuantityInput(index, value) {
    const quantity = parseInt(value);
    if (isNaN(quantity) || quantity < 1) {
        updateSaleItemsTable();
        return;
    }
    
    currentSaleItems[index].quantity = quantity;
    updateSaleItemsTable();
}

function removeFromSale(index) {
    currentSaleItems.splice(index, 1);
    updateSaleItemsTable();
    showAlert('Producto removido de la venta', 'success');
}

function clearCurrentSale() {
    if (currentSaleItems.length === 0) {
        showAlert('No hay productos en la venta', 'info');
        return;
    }
    
    if (confirm('¿Está seguro de limpiar la venta actual? Se perderán todos los productos agregados.')) {
        currentSaleItems = [];
        selectedProducts = [];
        document.getElementById('sale-client').value = '';
        document.getElementById('sale-quantity').value = 1;
        document.getElementById('partial-payment-checkbox').checked = false;
        togglePartialPayment();
        updateSaleItemsTable();
        showAlert('Venta limpiada correctamente', 'success');
    }
}

// === FUNCIONES DE HISTORIAL DE VENTAS ===
async function loadSalesHistory() {
    const sales = await getSales();
    const clients = await getClients();
    const tbody = document.getElementById('sales-history-body');
    tbody.innerHTML = '';
    
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-receipt"></i><p>No hay ventas registradas</p></td></tr>';
        return;
    }
    
    sales.slice().reverse().forEach(sale => {
        const client = clients.find(c => c.id === sale.clientId);
        const statusClass = sale.status === 'Pagado' ? 'badge-success' : 
                          sale.status === 'Separado' ? 'badge-warning' : 'badge-danger';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${sale.id.toString().padStart(4, '0')}</td>
            <td>${client ? client.name : 'N/A'}</td>
            <td>${sale.date}</td>
            <td>S/${sale.total.toFixed(2)}</td>
            <td><span class="badge ${statusClass}">${sale.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="showSaleReceipt(${sale.id})">
                        <i class="fas fa-receipt"></i> Ver
                    </button>
                    ${sale.status === 'Separado' ? `
                    <button class="btn btn-success btn-sm" onclick="showPendingSaleDetails(${sale.id})">
                        <i class="fas fa-money-bill-wave"></i> Pagar
                    </button>
                    ` : ''}
                    <button class="btn btn-danger btn-sm" onclick="deleteSale(${sale.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadRecentSales() {
    const sales = await getSales();
    const clients = await getClients();
    const tbody = document.getElementById('recent-sales-body');
    tbody.innerHTML = '';
    
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fas fa-receipt"></i><p>No hay ventas recientes</p></td></tr>';
        return;
    }
    
    sales.slice(-5).reverse().forEach(sale => {
        const client = clients.find(c => c.id === sale.clientId);
        const statusClass = sale.status === 'Pagado' ? 'badge-success' : 
                          sale.status === 'Separado' ? 'badge-warning' : 'badge-danger';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${sale.id.toString().padStart(4, '0')}</td>
            <td>${client ? client.name : 'N/A'}</td>
            <td>${sale.date}</td>
            <td>S/${sale.total.toFixed(2)}</td>
            <td><span class="badge ${statusClass}">${sale.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteSale(saleId) {
    if (confirm('¿Está seguro de eliminar esta venta? Esta acción no se puede deshacer.')) {
        const sales = await getSales();
        const updatedSales = sales.filter(s => s.id !== saleId);
        await saveSales(updatedSales);
        showAlert('Venta eliminada correctamente', 'success');
        
        // Actualizar dashboard
        setTimeout(() => {
            updateDashboardStats();
        }, 500);
    }
}

// === FUNCIONES DEL DASHBOARD ===
async function updateDashboardStats() {
    try {
        console.log('Actualizando dashboard...');
        
        const products = await getProducts();
        const clients = await getClients();
        const sales = await getSales();
        
        console.log('Datos obtenidos:', {
            productos: products.length,
            clientes: clients.length, 
            ventas: sales.length
        });
        
        const totalProducts = products.length;
        const totalClients = clients.length;
        const totalSales = sales.length;
        
        // Calcular ingresos mensuales
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const monthlyRevenue = sales
            .filter(sale => {
                try {
                    const saleDate = new Date(sale.date);
                    return saleDate.getMonth() === currentMonth && 
                           saleDate.getFullYear() === currentYear;
                } catch (error) {
                    console.error('Error procesando fecha:', sale.date);
                    return false;
                }
            })
            .reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
        
        // Productos con stock bajo
        const lowStockProducts = products.filter(p => {
            const stock = parseInt(p.stock) || 0;
            const minStock = parseInt(p.minStock) || 0;
            return stock > 0 && stock <= minStock;
        }).length;
        
        // Productos sin stock
        const outOfStockProducts = products.filter(p => {
            const stock = parseInt(p.stock) || 0;
            return stock === 0;
        }).length;
        
        // Ventas pendientes (separaciones)
        const pendingSales = sales.filter(s => s.status === 'Separado').length;
        const totalPendingAmount = sales
            .filter(s => s.status === 'Separado')
            .reduce((sum, sale) => sum + (parseFloat(sale.pendingAmount) || 0), 0);
        
        console.log('Estadísticas calculadas:', {
            totalProducts,
            totalClients,
            totalSales,
            monthlyRevenue,
            lowStockProducts,
            outOfStockProducts,
            pendingSales
        });
        
        // Actualizar la interfaz
        const totalProductsEl = document.getElementById('total-products');
        const totalClientsEl = document.getElementById('total-clients');
        const totalSalesEl = document.getElementById('total-sales');
        const monthlyRevenueEl = document.getElementById('monthly-revenue');
        const lowStockAlertEl = document.getElementById('low-stock-alert');
        
        if (totalProductsEl) totalProductsEl.textContent = totalProducts;
        if (totalClientsEl) totalClientsEl.textContent = totalClients;
        if (totalSalesEl) totalSalesEl.textContent = totalSales;
        if (monthlyRevenueEl) monthlyRevenueEl.textContent = monthlyRevenue.toFixed(2);
        if (lowStockAlertEl) {
            lowStockAlertEl.textContent = lowStockProducts + outOfStockProducts;
            
            // Mostrar/ocultar alerta de stock
            const lowStockContainer = lowStockAlertEl.closest('.stat-card');
            if (lowStockContainer) {
                if (lowStockProducts > 0 || outOfStockProducts > 0) {
                    lowStockContainer.style.display = 'block';
                    
                    let alertText = '';
                    if (outOfStockProducts > 0) {
                        alertText += `${outOfStockProducts} sin stock`;
                    }
                    if (lowStockProducts > 0) {
                        if (alertText) alertText += ' • ';
                        alertText += `${lowStockProducts} con stock bajo`;
                    }
                    lowStockAlertEl.textContent = alertText;
                } else {
                    lowStockContainer.style.display = 'none';
                }
            }
        }
        
        // Actualizar ventas pendientes en el dashboard
        updatePendingSalesAlert(pendingSales, totalPendingAmount);
        
        console.log('Dashboard actualizado correctamente');
        
    } catch (error) {
        console.error('Error actualizando dashboard:', error);
        showAlert('Error al actualizar el dashboard: ' + error.message, 'error');
    }
}

// Función para mostrar alerta de ventas pendientes
function updatePendingSalesAlert(pendingSales, totalPendingAmount) {
    let pendingAlert = document.querySelector('.pending-sales-alert');
    
    if (pendingSales > 0) {
        if (!pendingAlert) {
            pendingAlert = document.createElement('div');
            pendingAlert.className = 'alert alert-warning pending-sales-alert';
            pendingAlert.style.margin = '20px 0';
            pendingAlert.style.padding = '15px';
            pendingAlert.style.borderRadius = '8px';
            pendingAlert.style.border = '1px solid #ffeaa7';
            pendingAlert.style.backgroundColor = '#fff9e6';
            
            const dashboardSection = document.getElementById('dashboard-section');
            if (dashboardSection) {
                const statsGrid = dashboardSection.querySelector('.stats-grid');
                if (statsGrid) {
                    dashboardSection.insertBefore(pendingAlert, statsGrid);
                } else {
                    dashboardSection.appendChild(pendingAlert);
                }
            }
        }
        
        pendingAlert.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center;">
                    <i class="fas fa-clock" style="font-size: 1.2em; margin-right: 10px; color: #f39c12;"></i>
                    <div>
                        <strong style="color: #e67e22;">Tienes ${pendingSales} ventas pendientes</strong>
                        <div style="font-size: 0.9em; color: #7d6608;">
                            Total pendiente: S/ ${totalPendingAmount.toFixed(2)}
                        </div>
                    </div>
                </div>
                <button class="btn btn-success btn-sm" onclick="showSection('sales')">
                    <i class="fas fa-eye"></i> Ver Pendientes
                </button>
            </div>
        `;
    } else if (pendingAlert) {
        pendingAlert.remove();
    }
}

// === FUNCIONES DE BOLETA ELECTRÓNICA ===
async function showSaleReceipt(saleId) {
    const sales = await getSales();
    const clients = await getClients();
    const sale = sales.find(s => s.id === saleId);
    const client = clients.find(c => c.id === sale.clientId);
    
    const now = new Date();
    const currentDate = now.toLocaleDateString('es-PE');
    const currentTime = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Mapeo de métodos de pago para mostrar nombres más amigables
    const paymentMethodNames = {
        'efectivo': 'EFECTIVO',
        'tarjeta': 'TARJETA',
        'transferencia': 'TRANSFERENCIA',
        'yape': 'YAPE/PLIN'
    };
    
    // Información de pago mejorada
    const paymentInfo = sale.isPartialPayment && sale.status === 'Separado'
        ? `
            <p><i class="fas fa-money-bill-wave"></i> <strong>Método de Pago:</strong> ${paymentMethodNames[sale.paymentMethod] || sale.paymentMethod.toUpperCase()}</p>
            <p><i class="fas fa-cash-register"></i> <strong>Adelanto:</strong> S/ ${sale.paidAmount.toFixed(2)}</p>
            <p><i class="fas fa-clock"></i> <strong>Saldo Pendiente:</strong> S/ ${sale.pendingAmount.toFixed(2)}</p>
            <p><i class="fas fa-check-circle"></i> <strong>Estado:</strong> <span class="sale-status status-separado">SEPARADO</span></p>
        `
        : `
            <p><i class="fas fa-money-bill-wave"></i> <strong>Método de Pago:</strong> ${paymentMethodNames[sale.paymentMethod] || sale.paymentMethod.toUpperCase()}</p>
            <p><i class="fas fa-check-circle"></i> <strong>Estado:</strong> <span class="sale-status status-paid">PAGADO</span></p>
        `;

    const receiptHTML = `
        <div class="electronic-receipt" id="electronic-receipt">
            <div class="receipt-header">
                <div class="company-brand">
                    <div class="company-logo">
                        <img src="./logo.png" alt="SkinBri Shop" class="logo-img">
                    </div>
                    <div class="company-info">
                        <h1>SkinBri Shop</h1>
                        <p class="company-slogan">Tus productos favoritos a un super precio</p>
                        <div class="company-details">
                            <span><i class="fas fa-phone"></i>  942 571 951</span>
                            <span><i class="fas fa-map-marker-alt"></i> Tarma - Junín </span>
                        </div>
                    </div>
                </div>
                <div class="receipt-badge">
                    <div class="badge-content">
                        <span>${sale.isPartialPayment && sale.status === 'Separado' ? 'COMPROBANTE DE SEPARACIÓN' : 'BOLETA ELECTRÓNICA'}</span>
                        <div class="receipt-number">${sale.isPartialPayment && sale.status === 'Separado' ? 'S' : 'B'}001-${sale.id.toString().padStart(4, '0')}</div>
                    </div>
                </div>
            </div>

            <div class="receipt-meta">
                <div class="meta-grid">
                    <div class="meta-item">
                        <label><i class="fas fa-calendar"></i> Fecha:</label>
                        <span>${currentDate}</span>
                    </div>
                    <div class="meta-item">
                        <label><i class="fas fa-clock"></i> Hora:</label>
                        <span>${currentTime}</span>
                    </div>
                    <div class="meta-item">
                        <label><i class="fas fa-user-tie"></i> Vendedor:</label>
                        <span>Brayan</span>
                    </div>
                </div>
            </div>

            <div class="client-section">
                <div class="section-header-compact">
                    <i class="fas fa-user"></i> DATOS DEL CLIENTE
                </div>
                <div class="client-details-compact">
                    <div class="client-row">
                        <span><strong>Nombre:</strong> ${client.name}</span>
                        <span><strong>DNI:</strong> ${client.dni || 'N/A'}</span>
                    </div>
                    <div class="client-row">
                        <span><strong>Email:</strong> ${client.email || 'No registrado'}</span>
                        <span><strong>Teléfono:</strong> ${client.phone || 'No registrado'}</span>
                    </div>
                </div>
            </div>

            <div class="products-section">
                <div class="section-header-compact">
                    <i class="fas fa-shopping-cart"></i> DETALLE DE PRODUCTOS
                </div>
                <div class="products-table-container">
                    <table class="products-table-compact">
                        <thead>
                            <tr>
                                <th class="product-col">Descripción</th>
                                <th class="qty-col">Cant.</th>
                                <th class="price-col">P. Unit.</th>
                                <th class="total-col">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sale.items.map(item => `
                                <tr>
                                    <td class="product-name">${item.name}</td>
                                    <td class="quantity">${item.quantity}</td>
                                    <td class="unit-price">S/ ${item.price.toFixed(2)}</td>
                                    <td class="product-total">S/ ${item.total.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="totals-section-compact">
                <div class="totals-grid-compact">
                    <div class="total-row">
                        <span class="total-label">SUBTOTAL:</span>
                        <span class="total-value">S/ ${sale.subtotal.toFixed(2)}</span>
                    </div>
                    <div class="total-row">
                        <span class="total-label">IGV (0%):</span>
                        <span class="total-value">S/ 0.00</span>
                    </div>
                    <div class="total-row grand-total">
                        <span class="total-label">TOTAL A PAGAR:</span>
                        <span class="total-value">S/ ${sale.total.toFixed(2)}</span>
                    </div>
                    ${sale.isPartialPayment && sale.status === 'Separado' ? `
                    <div class="total-row">
                        <span class="total-label">ADELANTO:</span>
                        <span class="total-value">S/ ${sale.paidAmount.toFixed(2)}</span>
                    </div>
                    <div class="total-row">
                        <span class="total-label">SALDO PENDIENTE:</span>
                        <span class="total-value">S/ ${sale.pendingAmount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <div class="receipt-footer-compact">
                <div class="footer-info">${paymentInfo}</div>
                
                <div class="legal-compact">
                    <p><strong>${sale.isPartialPayment && sale.status === 'Separado' ? '¡Gracias por su separación!' : '¡Gracias por su compra!'}</strong></p>
                    <p>Recuerde que tenemos los mejores precios</p>
                    <p><strong> Nuestras redes sociales</strong></p>  
                    <span><i class="fab fa-whatsapp"></i>  942 571 951</span>
                    <span><i"></i> | </span>
                    <span><i class="fab fa-tiktok"></i> @skinbrishop</span>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('receipt-content').innerHTML = receiptHTML;
    updateReceiptModalFooter(saleId, client);
    document.getElementById('sale-receipt-modal').style.display = 'flex';
    
    setupReceiptModalESC();
}

function setupReceiptModalESC() {
    const closeOnEsc = function(e) {
        if (e.key === 'Escape') {
            closeReceiptModal();
            document.removeEventListener('keydown', closeOnEsc);
        }
    };
    
    document.removeEventListener('keydown', closeOnEsc);
    document.addEventListener('keydown', closeOnEsc);
}

function closeReceiptModal() {
    document.getElementById('sale-receipt-modal').style.display = 'none';
    document.removeEventListener('keydown', setupReceiptModalESC);
}

function updateReceiptModalFooter(saleId, client) {
    const modalFooter = document.querySelector('#sale-receipt-modal .modal-footer');
    modalFooter.innerHTML = `
        <button class="btn btn-success btn-sm" onclick="printReceipt()">
            <i class="fas fa-print"></i> Imprimir
        </button>
        <button class="btn btn-whatsapp btn-sm" onclick="shareToWhatsApp(${saleId})">
            <i class="fab fa-whatsapp"></i> Enviar por WhatsApp
        </button>
        <button class="btn btn-danger btn-sm" onclick="closeReceiptModal()">
            <i class="fas fa-times"></i> Cerrar (ESC)
        </button>
    `;
}

// === FUNCIONES DE IMPRESIÓN Y WHATSAPP ===
async function shareToWhatsApp(saleId) {
    const sales = await getSales();
    const clients = await getClients();
    const sale = sales.find(s => s.id === saleId);
    const client = clients.find(c => c.id === sale.clientId);
    
    const loadingAlert = document.createElement('div');
    loadingAlert.className = 'alert alert-success';
    loadingAlert.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF... por favor espere';
    loadingAlert.style.position = 'fixed';
    loadingAlert.style.top = '20px';
    loadingAlert.style.right = '20px';
    loadingAlert.style.zIndex = '9999';
    document.body.appendChild(loadingAlert);
    
    try {
        const receiptElement = document.getElementById('electronic-receipt');
        if (!receiptElement) {
            throw new Error('No se encontró la boleta');
        }
        
        const modalFooter = document.querySelector('#sale-receipt-modal .modal-footer');
        const originalDisplay = modalFooter ? modalFooter.style.display : '';
        if (modalFooter) modalFooter.style.display = 'none';
        
        if (typeof html2canvas === 'undefined') {
            const script1 = document.createElement('script');
            script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            document.head.appendChild(script1);
            await new Promise(resolve => script1.onload = resolve);
        }
        
        if (typeof jspdf === 'undefined') {
            const script2 = document.createElement('script');
            script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            document.head.appendChild(script2);
            await new Promise(resolve => script2.onload = resolve);
        }
        
        const canvas = await html2canvas(receiptElement, {
            scale: 3,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 800,
            windowHeight: receiptElement.scrollHeight
        });
        
        if (modalFooter) modalFooter.style.display = originalDisplay;
        
        const imgData = canvas.toDataURL('image/png', 1.0);
        const { jsPDF } = window.jspdf;
        
        const pdfWidth = 210;
        const pdfHeight = 297;
        const imgWidth = pdfWidth - 20;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
        });
        
        let finalHeight = imgHeight;
        let finalWidth = imgWidth;
        
        if (imgHeight > pdfHeight - 20) {
            finalHeight = pdfHeight - 20;
            finalWidth = (canvas.width * finalHeight) / canvas.height;
        }
        
        const xOffset = (pdfWidth - finalWidth) / 2;
        const yOffset = 10;
        
        pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight, '', 'FAST');
        
        const fileName = `${sale.isPartialPayment && sale.status === 'Separado' ? 'Separacion' : 'Boleta'}_${sale.id.toString().padStart(4, '0')}_${client.name.replace(/\s+/g, '_')}.pdf`;
        pdf.save(fileName);
        
        const message = sale.isPartialPayment && sale.status === 'Separado'
            ? `¡Hola ${client.name}! 👋\n\n` +
              `*SkinBri Shop* te envía tu comprobante de separación.\n\n` +
              `📄 *N° Separación:* S001-${sale.id.toString().padStart(4, '0')}\n` +
              `📅 *Fecha:* ${sale.date}\n` +
              `👤 *Cliente:* ${client.name}\n` +
              `💰 *Total:* S/${sale.total.toFixed(2)}\n` +
              `💵 *Adelanto:* S/${sale.paidAmount.toFixed(2)}\n` +
              `⏳ *Saldo Pendiente:* S/${sale.pendingAmount.toFixed(2)}\n\n` +
              `¡Gracias por tu confianza! 🎉`
            : `¡Hola ${client.name}! 👋\n\n` +
              `*SkinBri Shop* te envía tu comprobante de venta.\n\n` +
              `📄 *N° Boleta:* B001-${sale.id.toString().padStart(4, '0')}\n` +
              `📅 *Fecha:* ${sale.date}\n` +
              `👤 *Cliente:* ${client.name}\n` +
              `💰 *Total:* S/${sale.total.toFixed(2)}\n\n` +
              `¡Gracias por tu compra! 🎉`;
        
        const encodedMessage = encodeURIComponent(message);
        const phoneNumber = client.phone ? client.phone.replace(/\D/g, '') : '';
        
        setTimeout(() => {
            const whatsappUrl = phoneNumber 
                ? `https://wa.me/51${phoneNumber}?text=${encodedMessage}`
                : `https://wa.me/?text=${encodedMessage}`;
            window.open(whatsappUrl, '_blank');
        }, 1500);
        
        loadingAlert.remove();
        showAlert('✅ PDF generado y descargado. Adjúntalo en WhatsApp', 'success');
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        loadingAlert.remove();
        showAlert('❌ Error al generar el PDF: ' + error.message, 'error');
        
        const modalFooter = document.querySelector('#sale-receipt-modal .modal-footer');
        if (modalFooter) modalFooter.style.display = '';
    }
}

async function printReceipt() {
    const receiptElement = document.getElementById('electronic-receipt');
    if (!receiptElement) {
        showAlert('Error: No se encontró la boleta', 'error');
        return;
    }

    const loadingAlert = showAlert('Preparando boleta para impresión...', 'info');
    
    try {
        const modalFooter = document.querySelector('#sale-receipt-modal .modal-footer');
        const originalDisplay = modalFooter ? modalFooter.style.display : '';
        if (modalFooter) modalFooter.style.display = 'none';

        const canvas = await html2canvas(receiptElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: receiptElement.scrollWidth,
            height: receiptElement.scrollHeight
        });

        if (modalFooter) modalFooter.style.display = originalDisplay;

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = pdfWidth - 20;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const x = (pdfWidth - imgWidth) / 2;
        const y = 10;

        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        const printWindow = window.open(pdfUrl);
        if (printWindow) {
            setTimeout(() => {
                printWindow.print();
            }, 1000);
        }

        loadingAlert.remove();
        
    } catch (error) {
        console.error('Error al imprimir:', error);
        loadingAlert.remove();
        showAlert('Error al generar PDF: ' + error.message, 'error');
    }
}

// === FUNCIONES DE REPORTES ===
async function generateReport() {
    const type = document.getElementById('report-type').value;
    const period = document.getElementById('report-period').value;
    
    if (!type || !period) {
        showAlert('Seleccione tipo y período', 'error');
        return;
    }
    
    const today = new Date();
    let startDate, endDate;
    
    switch (period) {
        case 'today':
            startDate = new Date(today);
            endDate = new Date(today);
            break;
        case 'week':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            endDate = new Date(today);
            break;
        case 'month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'year':
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
            break;
    }
    
    let content = '';
    const sales = await getSales();
    const products = await getProducts();
    const clients = await getClients();
    
    if (type === 'sales') {
        const filtered = sales.filter(s => {
            const saleDate = new Date(s.date);
            return saleDate >= startDate && saleDate <= endDate;
        });
        
        const total = filtered.reduce((sum, s) => sum + s.total, 0);
        const totalSales = filtered.length;
        
        content = `
            <h4>Reporte de Ventas</h4>
            <p><strong>Período:</strong> ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</p>
            <p><strong>Total Ventas:</strong> ${totalSales}</p>
            <p><strong>Ingresos Totales:</strong> S/${total.toFixed(2)}</p>
            
            ${totalSales > 0 ? `
            <table class="table">
                <thead>
                    <tr>
                        <th>ID Venta</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(s => {
                        const client = clients.find(c => c.id === s.clientId);
                        const statusClass = s.status === 'Pagado' ? 'badge-success' : 'badge-warning';
                        return `
                            <tr>
                                <td>#${s.id.toString().padStart(4, '0')}</td>
                                <td>${client ? client.name : 'N/A'}</td>
                                <td>${s.date}</td>
                                <td>S/${s.total.toFixed(2)}</td>
                                <td><span class="badge ${statusClass}">${s.status}</span></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            ` : '<p class="empty-state">No hay ventas en este período</p>'}
        `;
    } else if (type === 'products') {
        const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
        const lowStockProducts = products.filter(p => p.stock <= p.minStock);
        
        content = `
            <h4>Reporte de Inventario</h4>
            <p><strong>Total Productos:</strong> ${products.length}</p>
            <p><strong>Valor Total Inventario:</strong> S/${totalValue.toFixed(2)}</p>
            <p><strong>Productos con Stock Bajo:</strong> ${lowStockProducts.length}</p>
            
            <h5 style="margin-top: 20px;">Productos con Stock Bajo</h5>
            ${lowStockProducts.length > 0 ? `
            <table class="table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Stock Actual</th>
                        <th>Stock Mínimo</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${lowStockProducts.map(p => `
                        <tr>
                            <td>${p.name}</td>
                            <td>${p.stock}</td>
                            <td>${p.minStock}</td>
                            <td><span class="badge badge-warning">Stock Bajo</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : '<p>No hay productos con stock bajo</p>'}
            
            <h5 style="margin-top: 20px;">Todos los Productos</h5>
            <table class="table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Precio</th>
                        <th>Stock</th>
                        <th>Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(p => `
                        <tr>
                            <td>${p.name}</td>
                            <td>${p.category}</td>
                            <td>S/${p.price.toFixed(2)}</td>
                            <td>${p.stock}</td>
                            <td>S/${(p.price * p.stock).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else if (type === 'clients') {
        const premiumClients = clients.filter(c => c.type === 'premium').length;
        const regularClients = clients.filter(c => c.type === 'regular').length;
        
        content = `
            <h4>Reporte de Clientes</h4>
            <p><strong>Total Clientes:</strong> ${clients.length}</p>
            <p><strong>Clientes Premium:</strong> ${premiumClients}</p>
            <p><strong>Clientes Regulares:</strong> ${regularClients}</p>
            
            <table class="table">
                <thead>
                    <tr>
                        <th>DNI</th>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Teléfono</th>
                        <th>Tipo</th>
                        <th>Compras</th>
                    </tr>
                </thead>
                <tbody>
                    ${clients.map(c => {
                        const purchases = sales.filter(s => s.clientId === c.id).length;
                        const typeClass = c.type === 'premium' ? 'badge-success' : 'badge-primary';
                        return `
                            <tr>
                                <td>${c.dni || 'N/A'}</td>
                                <td>${c.name}</td>
                                <td>${c.email || 'N/A'}</td>
                                <td>${c.phone || 'N/A'}</td>
                                <td><span class="badge ${typeClass}">${c.type}</span></td>
                                <td>${purchases}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }
    
    document.getElementById('report-content').innerHTML = content;
    document.getElementById('report-results').classList.remove('hidden');
}

// === FUNCIONES DE NAVEGACIÓN Y UI ===
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(section + '-section');
    if (target) target.classList.remove('hidden');
    
    if (section === 'dashboard') {
        updateDashboardStats();
        loadPendingSalesDashboard();
    } else if (section === 'sales') {
        populateSaleSelects();
    }
}

function showProductForm() {
    document.getElementById('product-form-title').textContent = 'Agregar Producto';
    document.getElementById('product-name').value = '';
    document.getElementById('product-category').value = 'Electrónicos';
    document.getElementById('product-price').value = '';
    document.getElementById('product-stock').value = '0';
    document.getElementById('product-cost').value = '';
    document.getElementById('product-min-stock').value = '5';
    document.getElementById('product-description').value = '';
    document.getElementById('product-modal').style.display = 'flex';
    editingProductId = null;
}

function hideProductForm() {
    document.getElementById('product-modal').style.display = 'none';
    editingProductId = null;
}

function showClientForm() {
    document.getElementById('client-form-title').textContent = 'Agregar Cliente';
    document.getElementById('client-dni').value = '';
    document.getElementById('client-name').value = '';
    document.getElementById('client-name').setAttribute('readonly', 'true');
    document.getElementById('client-email').value = '';
    document.getElementById('client-phone').value = '';
    document.getElementById('client-address').value = '';
    document.getElementById('client-type').value = 'regular';
    document.getElementById('client-modal').style.display = 'flex';
    editingClientId = null;
    
    setTimeout(() => {
        document.getElementById('client-dni').focus();
    }, 100);
}

function hideClientForm() {
    document.getElementById('client-modal').style.display = 'none';
    editingClientId = null;
}

// === FUNCIONES DE API RENIEC ===
async function searchDNI() {
    const dni = document.getElementById('client-dni').value.trim();
    const searchBtn = document.getElementById('search-dni-btn');
    
    if (dni.length !== 8) {
        showAlert('Ingrese un DNI válido de 8 dígitos', 'error');
        return;
    }

    searchBtn.disabled = true;
    searchBtn.innerHTML = '<div class="spinner"></div> Buscando...';

    try {
        const response = await fetch(`${API_CONFIG.baseUrl}/dni/${dni}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_CONFIG.token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            const fullName = `${data.data.nombres} ${data.data.apellido_paterno} ${data.data.apellido_materno}`;
            document.getElementById('client-name').value = fullName.trim();
            document.getElementById('client-name').removeAttribute('readonly');
            showAlert('✓ Datos encontrados exitosamente', 'success');
        } else {
            throw new Error(data.message || 'DNI no encontrado');
        }
        
    } catch (error) {
        console.error('Error al buscar DNI:', error);
        
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            showAlert('❌ Token inválido o expirado', 'error');
        } else if (error.message.includes('404') || error.message.includes('No encontrado')) {
            showAlert('❌ DNI no encontrado en RENIEC', 'error');
        } else if (error.message.includes('429')) {
            showAlert('⚠️ Límite de consultas excedido', 'error');
        } else {
            showAlert('❌ Error: ' + error.message, 'error');
        }
        
        document.getElementById('client-name').removeAttribute('readonly');
        document.getElementById('client-name').focus();
    } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = '<i class="fas fa-search"></i> Buscar';
    }
}

function setupDNIValidation() {
    const dniInput = document.getElementById('client-dni');
    const searchBtn = document.getElementById('search-dni-btn');
    
    dniInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 8);
        searchBtn.disabled = e.target.value.length !== 8;
        
        if (document.getElementById('client-name').value && !editingClientId) {
            document.getElementById('client-name').value = '';
            document.getElementById('client-name').setAttribute('readonly', 'true');
        }
    });
    
    dniInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value.length === 8) {
            searchDNI();
        }
    });
}

// === FUNCIONES UTILITARIAS ===
function showAlert(message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type === 'error' ? 'error' : 'success'}`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        ${message}
    `;
    
    const container = document.querySelector('.content-container');
    container.insertBefore(alert, container.firstChild);
    
    setTimeout(() => alert.remove(), 4000);
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// === MENÚ MÓVIL ===
function setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    // Crear overlay si no existe
    let sidebarOverlay = document.getElementById('sidebarOverlay');
    if (!sidebarOverlay) {
        sidebarOverlay = document.createElement('div');
        sidebarOverlay.id = 'sidebarOverlay';
        sidebarOverlay.className = 'sidebar-overlay';
        document.body.appendChild(sidebarOverlay);
    }

    function toggleSidebar() {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
    }

    function closeSidebar() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }

    sidebarOverlay.addEventListener('click', closeSidebar);

    // Cerrar sidebar al hacer clic en un enlace
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeSidebar();
            }
        });
    });

    // Cerrar sidebar al redimensionar
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeSidebar();
        }
    });
}

// === LIMPIAR HISTORIAL DE VENTAS ===
async function clearAllSalesHistory() {
    const sales = await getSales();
    
    if (sales.length === 0) {
        showAlert('No hay ventas en el historial', 'info');
        return;
    }
    
    if (confirm(`¿Está COMPLETAMENTE SEGURO de eliminar TODAS las ${sales.length} ventas del historial?\n\n⚠️ ADVERTENCIA: Esta acción eliminará todo el historial y reiniciará el contador a #0001.\n\n¡ESTA ACCIÓN NO SE PUEDE DESHACER!`)) {
        if (confirm('🔴 ÚLTIMA CONFIRMACIÓN:\n\n¿Realmente desea borrar TODO el historial de ventas?\n\nEscriba "SI" en su mente y presione Aceptar para continuar.')) {
            await saveSales([]);
            showAlert('✅ Historial de ventas eliminado completamente. El contador se reinició a #0001', 'success');
            
            // Actualizar dashboard
            setTimeout(() => {
                updateDashboardStats();
            }, 500);
        }
    }
}

// === FUNCIÓN COMPLETA DE VENTA CON ADELANTOS/SEPARACIONES ===
async function completeSale() {
    try {
        console.log('🔹 Iniciando proceso de venta...');
        
        const sales = await getSales();
        const products = await getProducts();
        const clientId = parseInt(document.getElementById('sale-client').value);
        
        console.log('🔹 Datos obtenidos:', { clientId, currentSaleItems });

        // Validaciones básicas
        if (!clientId) {
            showAlert('Seleccione un cliente', 'error');
            return;
        }
        
        if (currentSaleItems.length === 0) {
            showAlert('Agregue productos a la venta', 'error');
            return;
        }

        // Calcular montos base
        const subtotal = currentSaleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const igv = 0;
        const totalAmount = subtotal;
        
        console.log('🔹 Montos calculados:', { subtotal, totalAmount });

        let paidAmount = 0;
        let pendingAmount = 0;
        let saleStatus = 'Pagado';
        let saleType = 'Venta';
        
        // Validar según el tipo de pago
        if (isPartialPayment) {
            console.log('🔹 Procesando PAGO PARCIAL');
            
            const selectedTotal = parseFloat(document.getElementById('selected-total').textContent) || 0;
            const paymentAmountInput = document.getElementById('payment-amount').value;
            const paymentAmount = parseFloat(paymentAmountInput) || 0;
            
            console.log('🔹 Validando separación:', { selectedTotal, paymentAmountInput, paymentAmount });

            if (selectedProducts.length === 0) {
                showAlert('Seleccione al menos un producto para la separación', 'error');
                return;
            }
            
            if (paymentAmount <= 0) {
                showAlert('Ingrese un monto válido para el adelanto', 'error');
                document.getElementById('payment-amount').focus();
                return;
            }
            
            if (paymentAmount > selectedTotal) {
                showAlert(`El monto de adelanto (S/ ${paymentAmount.toFixed(2)}) no puede ser mayor al total seleccionado (S/ ${selectedTotal.toFixed(2)})`, 'error');
                document.getElementById('payment-amount').focus();
                return;
            }
            
            // Para separación: usar el monto ingresado como adelanto
            paidAmount = paymentAmount;
            pendingAmount = Math.max(0, selectedTotal - paidAmount);
            saleStatus = pendingAmount > 0 ? 'Separado' : 'Pagado';
            saleType = pendingAmount > 0 ? 'Separación' : 'Venta';
            
        } else {
            // PAGO COMPLETO
            console.log('🔹 Procesando PAGO COMPLETO');
            
            // Para pago completo: el monto pagado es igual al total, no necesita validar "monto recibido"
            paidAmount = totalAmount;
            pendingAmount = 0;
            saleStatus = 'Pagado';
            saleType = 'Venta';
            
            console.log('🔹 Pago completo procesado:', { totalAmount, paidAmount });
        }
        
        const newId = sales.length > 0 ? Math.max(...sales.map(s => s.id)) + 1 : 1;
        
        const newSale = {
            id: newId,
            clientId,
            date: new Date().toLocaleDateString('es-PE'),
            subtotal,
            igv,
            total: totalAmount,
            paidAmount,
            pendingAmount,
            status: saleStatus,
            type: saleType,
            paymentMethod: selectedPaymentMethod,
            isPartialPayment: isPartialPayment,
            selectedProducts: isPartialPayment ? selectedProducts : [],
            items: currentSaleItems.map(item => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity
            }))
        };
        
        console.log('🔹 Nueva venta creada:', newSale);
        
        // Actualizar stock solo si la venta está completamente pagada
        const updatedProducts = products.map(product => {
            const saleItem = currentSaleItems.find(item => item.productId === product.id);
            if (saleItem && saleStatus === 'Pagado') {
                const newStock = product.stock - saleItem.quantity;
                console.log(`🔹 Actualizando stock producto ${product.name}: ${product.stock} -> ${newStock}`);
                return { 
                    ...product, 
                    stock: Math.max(0, newStock) // Asegurar que no sea negativo
                };
            }
            return product;
        });
        
        await saveSales([...sales, newSale]);
        await saveProducts(updatedProducts);
        
        currentSaleId = newId;
        showSaleReceipt(newId);
        
        // Limpiar formulario
        currentSaleItems = [];
        selectedProducts = [];
        isPartialPayment = false;
        document.getElementById('sale-client').value = '';
        document.getElementById('partial-payment-checkbox').checked = false;
        document.getElementById('payment-amount').value = '';
        document.getElementById('amount-received').value = ''; // Limpiar pero no es obligatorio
        document.querySelectorAll('.payment-method').forEach(el => {
            el.classList.remove('selected');
        });
        
        updateSaleItemsTable();
        togglePartialPayment();
        
        showAlert(`${saleType} ${saleStatus.toLowerCase()} completada correctamente`, 'success');

        // Actualizar dashboard después de la venta
        setTimeout(() => {
            updateDashboardStats();
            loadProductsTable();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error en completeSale:', error);
        showAlert('Error al procesar la venta: ' + error.message, 'error');
    }
}

// === FUNCIONES PARA COMPLETAR PAGOS PENDIENTES ===
async function completePendingPayment(saleId) {
    const sales = await getSales();
    const clients = await getClients();
    const products = await getProducts();
    
    const sale = sales.find(s => s.id === saleId);
    if (!sale) {
        showAlert('Venta no encontrada', 'error');
        return;
    }
    
    if (sale.status !== 'Separado') {
        showAlert('Esta venta ya está pagada', 'info');
        return;
    }
    
    const client = clients.find(c => c.id === sale.clientId);
    const remainingAmount = sale.pendingAmount;
    
    // Mostrar modal de confirmación
    if (confirm(`¿Completar el pago pendiente de ${client.name}?\n\nSaldo pendiente: S/ ${remainingAmount.toFixed(2)}\nTotal original: S/ ${sale.total.toFixed(2)}`)) {
        
        // Actualizar la venta
        const updatedSales = sales.map(s => {
            if (s.id === saleId) {
                return {
                    ...s,
                    paidAmount: s.total, // Ahora está completamente pagado
                    pendingAmount: 0,
                    status: 'Pagado',
                    paymentDate: new Date().toLocaleDateString('es-PE')
                };
            }
            return s;
        });
        
        // Actualizar stock de productos (ya que ahora está completamente pagado)
        const updatedProducts = products.map(product => {
            const saleItem = sale.items.find(item => item.productId === product.id);
            if (saleItem) {
                const newStock = product.stock - saleItem.quantity;
                return { 
                    ...product, 
                    stock: newStock 
                };
            }
            return product;
        });
        
        await saveSales(updatedSales);
        await saveProducts(updatedProducts);
        
        showAlert(`✅ Pago completado exitosamente. Stock actualizado.`, 'success');
        
        // Recargar datos
        loadSalesHistory();
        loadRecentSales();
        updateDashboardStats();
        loadPendingSalesDashboard();
    }
}

// Función para mostrar detalles de venta pendiente
async function showPendingSaleDetails(saleId) {
    const sales = await getSales();
    const clients = await getClients();
    const sale = sales.find(s => s.id === saleId);
    const client = clients.find(c => c.id === sale.clientId);
    
    if (!sale || sale.status !== 'Separado') return;
    
    const modalHTML = `
        <div class="modal" id="pending-payment-modal">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-money-bill-wave"></i> Completar Pago Pendiente</h3>
                        <button class="btn-close close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="sale-details">
                            <h4>Detalles de la Separación</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <label>Cliente:</label>
                                    <span>${client.name}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Fecha de Separación:</label>
                                    <span>${sale.date}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Total:</label>
                                    <span>S/ ${sale.total.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Adelanto Pagado:</label>
                                    <span>S/ ${sale.paidAmount.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Saldo Pendiente:</label>
                                    <span class="pending-amount">S/ ${sale.pendingAmount.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Método de Pago Original:</label>
                                    <span>${sale.paymentMethod.toUpperCase()}</span>
                                </div>
                            </div>
                            
                            <h5>Productos Separados</h5>
                            <div class="table-responsive">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>Cantidad</th>
                                            <th>Precio Unit.</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${sale.items.map(item => `
                                            <tr>
                                                <td>${item.name}</td>
                                                <td>${item.quantity}</td>
                                                <td>S/ ${item.price.toFixed(2)}</td>
                                                <td>S/ ${item.total.toFixed(2)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-success" onclick="completePendingPayment(${saleId})">
                            <i class="fas fa-check-circle"></i> Completar Pago
                        </button>
                        <button class="btn btn-danger" onclick="closePendingPaymentModal()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Agregar modal al DOM si no existe
    if (!document.getElementById('pending-payment-modal')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Mostrar modal
    document.getElementById('pending-payment-modal').style.display = 'flex';
    
    // Configurar cierre del modal
    setupModalClose('pending-payment-modal');
}

function closePendingPaymentModal() {
    const modal = document.getElementById('pending-payment-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function setupModalClose(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

// Función para cargar ventas pendientes en el dashboard
async function loadPendingSalesDashboard() {
    const sales = await getSales();
    const clients = await getClients();
    const pendingSales = sales.filter(s => s.status === 'Separado');
    
    const container = document.getElementById('pending-sales-list');
    if (!container) return;
    
    if (pendingSales.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No hay ventas pendientes</p></div>';
        return;
    }
    
    container.innerHTML = pendingSales.map(sale => {
        const client = clients.find(c => c.id === sale.clientId);
        return `
            <div class="pending-sale-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; margin-bottom: 8px;">
                <div style="flex: 1;">
                    <strong>#${sale.id.toString().padStart(4, '0')} - ${client ? client.name : 'Cliente no encontrado'}</strong>
                    <br>
                    <small style="color: #666;">Total: S/ ${sale.total.toFixed(2)} | Pendiente: S/ ${sale.pendingAmount.toFixed(2)}</small>
                    <br>
                    <small style="color: #888;">Fecha: ${sale.date}</small>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-primary btn-sm" onclick="showSaleReceipt(${sale.id})">
                        <i class="fas fa-receipt"></i>
                    </button>
                    <button class="btn btn-success btn-sm" onclick="showPendingSaleDetails(${sale.id})">
                        <i class="fas fa-money-bill-wave"></i> Pagar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Agregar estilos CSS para las ventas pendientes
const pendingStyles = `
<style>
.pending-sale-item {
    transition: all 0.3s ease;
}

.pending-sale-item:hover {
    background-color: #f8f9fa;
    border-radius: 8px;
}

.detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 15px;
}

.detail-item {
    display: flex;
    justify-content: space-between;
    padding: 8px;
    background: white;
    border-radius: 4px;
    border: 1px solid #e9ecef;
}

.detail-item label {
    font-weight: bold;
    color: #495057;
}

.pending-amount {
    color: #dc3545;
    font-weight: bold;
    font-size: 1.1em;
}

.sale-details {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 15px;
}
</style>
`;

// Agregar los estilos al documento
document.head.insertAdjacentHTML('beforeend', pendingStyles);

// Llamar esta función cuando se cargue el dashboard
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(section + '-section');
    if (target) target.classList.remove('hidden');
    
    if (section === 'dashboard') {
        updateDashboardStats();
        loadPendingSalesDashboard();
    } else if (section === 'sales') {
        populateSaleSelects();
    }
}
