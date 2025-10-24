// Variables globales
let currentSaleItems = [];
let editingProductId = null;
let editingClientId = null;
let currentSaleId = null;

// Configuración de la API RENIEC
const API_CONFIG = {
    baseUrl: 'https://apiperu.dev/api',
    token: '3a451e42f184f40438d77992c710b41f39de11872984aebf33058276a75a46c6'
};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeSystem();
    setupNavigation();
    setupEventListeners();
    loadInitialData();
});

function initializeSystem() {
    if (!localStorage.getItem('salesSystemInitialized')) {
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
        
        localStorage.setItem('products', JSON.stringify(initialData.products));
        localStorage.setItem('clients', JSON.stringify(initialData.clients));
        localStorage.setItem('sales', JSON.stringify(initialData.sales));
        localStorage.setItem('salesSystemInitialized', 'true');
    }
    showAlert('Sistema cargado correctamente', 'success');
}

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
    document.getElementById('complete-sale-btn').addEventListener('click', completeSale);
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

// API RENIEC
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

function loadInitialData() {
    loadProductsTable();
    loadClientsTable();
    loadSalesHistory();
    populateSaleSelects();
    loadRecentSales();
    updateDashboardStats();
}

function getProducts() { return JSON.parse(localStorage.getItem('products')) || []; }
function getClients() { return JSON.parse(localStorage.getItem('clients')) || []; }
function getSales() { return JSON.parse(localStorage.getItem('sales')) || []; }
function saveProducts(products) { localStorage.setItem('products', JSON.stringify(products)); }
function saveClients(clients) { localStorage.setItem('clients', JSON.stringify(clients)); }
function saveSales(sales) { localStorage.setItem('sales', JSON.stringify(sales)); }

function loadProductsTable() {
    const products = getProducts();
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

function loadClientsTable() {
    const clients = getClients();
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

function loadSalesHistory() {
    const sales = getSales();
    const clients = getClients();
    const tbody = document.getElementById('sales-history-body');
    tbody.innerHTML = '';
    
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-receipt"></i><p>No hay ventas</p></td></tr>';
        return;
    }
    
    sales.slice().reverse().forEach(sale => {
        const client = clients.find(c => c.id === sale.clientId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${sale.id.toString().padStart(4, '0')}</td>
            <td>${client ? client.name : 'N/A'}</td>
            <td>${sale.date}</td>
            <td>${sale.total.toFixed(2)}</td>
            <td><span class="badge badge-success">${sale.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="showSaleReceipt(${sale.id})">
                        <i class="fas fa-receipt"></i> Ver
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSale(${sale.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Función para eliminar una venta individual
function deleteSale(saleId) {
    if (confirm('¿Está seguro de eliminar esta venta? Esta acción no se puede deshacer.')) {
        const sales = getSales().filter(s => s.id !== saleId);
        saveSales(sales);
        loadSalesHistory();
        loadRecentSales();
        updateDashboardStats();
        showAlert('Venta eliminada correctamente', 'success');
    }
}

// Función para limpiar TODO el historial de ventas
function clearAllSalesHistory() {
    const sales = getSales();
    
    if (sales.length === 0) {
        showAlert('No hay ventas en el historial', 'info');
        return;
    }
    
    if (confirm(`¿Está COMPLETAMENTE SEGURO de eliminar TODAS las ${sales.length} ventas del historial?\n\n⚠️ ADVERTENCIA: Esta acción eliminará todo el historial y reiniciará el contador a #0001.\n\n¡ESTA ACCIÓN NO SE PUEDE DESHACER!`)) {
        // Confirmación adicional para mayor seguridad
        if (confirm('🔴 ÚLTIMA CONFIRMACIÓN:\n\n¿Realmente desea borrar TODO el historial de ventas?\n\nEscriba "SI" en su mente y presione Aceptar para continuar.')) {
            localStorage.removeItem('sales');
            localStorage.setItem('sales', JSON.stringify([]));
            
            loadSalesHistory();
            loadRecentSales();
            updateDashboardStats();
            
            showAlert('✅ Historial de ventas eliminado completamente. El contador se reinició a #0001', 'success');
        }
    }
}

function loadRecentSales() {
    const sales = getSales().slice(-5).reverse();
    const clients = getClients();
    const tbody = document.getElementById('recent-sales-body');
    tbody.innerHTML = '';
    
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fas fa-receipt"></i><p>No hay ventas recientes</p></td></tr>';
        return;
    }
    
    sales.forEach(sale => {
        const client = clients.find(c => c.id === sale.clientId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${sale.id.toString().padStart(4, '0')}</td>
            <td>${client ? client.name : 'N/A'}</td>
            <td>${sale.date}</td>
            <td>${sale.total.toFixed(2)}</td>
            <td><span class="badge badge-success">${sale.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

function updateDashboardStats() {
    const products = getProducts();
    const clients = getClients();
    const sales = getSales();
    
    const totalProducts = products.length;
    const totalClients = clients.length;
    const totalSales = sales.length;
    const monthlyRevenue = sales
        .filter(sale => {
            const saleDate = new Date(sale.date);
            const currentMonth = new Date();
            return saleDate.getMonth() === currentMonth.getMonth() && 
                   saleDate.getFullYear() === currentMonth.getFullYear();
        })
        .reduce((sum, sale) => sum + sale.total, 0);
    
    const lowStockProducts = products.filter(p => p.stock <= p.minStock).length;
    
    document.getElementById('total-products').textContent = totalProducts;
    document.getElementById('total-clients').textContent = totalClients;
    document.getElementById('total-sales').textContent = totalSales;
    document.getElementById('monthly-revenue').textContent = monthlyRevenue.toFixed(2);
    document.getElementById('low-stock-alert').textContent = lowStockProducts;
    
    const lowStockElement = document.getElementById('low-stock-alert');
    if (lowStockProducts > 0) {
        lowStockElement.parentElement.style.display = 'block';
    } else {
        lowStockElement.parentElement.style.display = 'none';
    }
}

function populateSaleSelects() {
    const clients = getClients();
    const products = getProducts();
    
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

function addProductToSale() {
    const productId = parseInt(document.getElementById('sale-product').value);
    const quantity = parseInt(document.getElementById('sale-quantity').value);
    
    if (!productId || quantity <= 0) {
        showAlert('Seleccione un producto y cantidad válida', 'error');
        return;
    }
    
    const product = getProducts().find(p => p.id === productId);
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
}

function updateSaleQuantity(index, change) {
    const productId = currentSaleItems[index].productId;
    const product = getProducts().find(p => p.id === productId);
    const newQuantity = currentSaleItems[index].quantity + change;
    
    if (newQuantity < 1) {
        removeFromSale(index);
        return;
    }
    
    if (newQuantity > product.stock) {
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
    
    const productId = currentSaleItems[index].productId;
    const product = getProducts().find(p => p.id === productId);
    
    if (quantity > product.stock) {
        showAlert(`No hay suficiente stock. Máximo disponible: ${product.stock} unidades`, 'error');
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
        document.getElementById('sale-client').value = '';
        document.getElementById('sale-quantity').value = 1;
        updateSaleItemsTable();
        showAlert('Venta limpiada correctamente', 'success');
    }
}

function completeSale() {
    const clientId = parseInt(document.getElementById('sale-client').value);
    
    if (!clientId) {
        showAlert('Seleccione un cliente', 'error');
        return;
    }
    
    if (currentSaleItems.length === 0) {
        showAlert('Agregue productos a la venta', 'error');
        return;
    }
    
    const subtotal = currentSaleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const igv = 0;
    const total = subtotal;
    
    const sales = getSales();
    // Cambiar la lógica del ID: siempre usar sales.length + 1
    const newId = sales.length + 1;
    
    const newSale = {
        id: newId,
        clientId,
        date: new Date().toLocaleDateString('es-PE'),
        subtotal,
        igv,
        total,
        status: 'Completada',
        items: currentSaleItems.map(item => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
        }))
    };
    
    const products = getProducts();
    const updatedProducts = products.map(product => {
        const saleItem = currentSaleItems.find(item => item.productId === product.id);
        if (saleItem) {
            const newStock = product.stock - saleItem.quantity;
            return { 
                ...product, 
                stock: newStock 
            };
        }
        return product;
    });
    
    saveSales([...sales, newSale]);
    saveProducts(updatedProducts);
    
    currentSaleId = newId;
    
    showSaleReceipt(newId);
    
    currentSaleItems = [];
    document.getElementById('sale-client').value = '';
    updateSaleItemsTable();
    
    loadProductsTable();
    loadSalesHistory();
    loadRecentSales();
    populateSaleSelects();
    updateDashboardStats();
}

// Función para mostrar boleta electrónica - DISEÑO COMPACTO
function showSaleReceipt(saleId) {
    const sale = getSales().find(s => s.id === saleId);
    const client = getClients().find(c => c.id === sale.clientId);
    
    const now = new Date();
    const currentDate = now.toLocaleDateString('es-PE');
    const currentTime = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const receiptHTML = `
        <div class="electronic-receipt" id="electronic-receipt">
            <!-- Tu HTML actual de la boleta aquí -->
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
                        <span>BOLETA ELECTRÓNICA</span>
                        <div class="receipt-number">B001-${sale.id.toString().padStart(4, '0')}</div>
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
                </div>
            </div>

            <div class="receipt-footer-compact">
                <div class="footer-info">
                    <p><i class="fas fa-money-bill-wave"></i> <strong>Pago:</strong> EFECTIVO</p>
                    <p><i class="fas fa-check-circle"></i> <strong>Estado:</strong> PAGADO</p>
                </div>
                
                <div class="legal-compact">
                    <p><strong>¡Gracias por su compra!</strong></p>
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
    
    // Configurar ESC correctamente
    setupReceiptModalESC();
}

function setupReceiptModalESC() {
    const closeOnEsc = function(e) {
        if (e.key === 'Escape') {
            closeReceiptModal();
            document.removeEventListener('keydown', closeOnEsc);
        }
    };
    
    // Remover listener anterior si existe
    document.removeEventListener('keydown', closeOnEsc);
    // Agregar nuevo listener
    document.addEventListener('keydown', closeOnEsc);
}

function closeReceiptModal() {
    document.getElementById('sale-receipt-modal').style.display = 'none';
    // Remover el listener ESC cuando se cierra el modal
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

// Función mejorada para compartir por WhatsApp con PDF
async function shareToWhatsApp(saleId) {
    const sale = getSales().find(s => s.id === saleId);
    const client = getClients().find(c => c.id === sale.clientId);
    
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
        
        const fileName = `Boleta_${sale.id.toString().padStart(4, '0')}_${client.name.replace(/\s+/g, '_')}.pdf`;
        pdf.save(fileName);
        
        const message = `¡Hola ${client.name}! 👋\n\n` +
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
        // Ocultar footer temporalmente
        const modalFooter = document.querySelector('#sale-receipt-modal .modal-footer');
        const originalDisplay = modalFooter ? modalFooter.style.display : '';
        if (modalFooter) modalFooter.style.display = 'none';

        // Capturar la boleta exactamente como se ve
        const canvas = await html2canvas(receiptElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: receiptElement.scrollWidth,
            height: receiptElement.scrollHeight
        });

        // Restaurar footer
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

        // Calcular dimensiones para mantener proporción
        const imgWidth = pdfWidth - 20; // margen
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Centrar en la página
        const x = (pdfWidth - imgWidth) / 2;
        const y = 10;

        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        
        // Abrir PDF en nueva ventana para imprimir
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

function closeReceiptModal() {
    document.getElementById('sale-receipt-modal').style.display = 'none';
}

function saveProduct() {
    const products = getProducts();
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
    
    saveProducts(products);
    loadProductsTable();
    populateSaleSelects();
    updateDashboardStats();
    hideProductForm();
    showAlert('Producto guardado correctamente', 'success');
}

function editProduct(id) {
    const product = getProducts().find(p => p.id === id);
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

function deleteProduct(id) {
    const product = getProducts().find(p => p.id === id);
    if (!product) return;
    
    if (confirm(`¿Está seguro de eliminar el producto "${product.name}"?`)) {
        const products = getProducts().filter(p => p.id !== id);
        saveProducts(products);
        loadProductsTable();
        populateSaleSelects();
        updateDashboardStats();
        showAlert('Producto eliminado correctamente', 'success');
    }
}

function saveClient() {
    const clients = getClients();
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
    
    saveClients(clients);
    loadClientsTable();
    populateSaleSelects();
    updateDashboardStats();
    hideClientForm();
    showAlert('Cliente guardado correctamente', 'success');
}

function editClient(id) {
    const client = getClients().find(c => c.id === id);
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

function deleteClient(id) {
    const client = getClients().find(c => c.id === id);
    if (!client) return;
    
    const clientSales = getSales().filter(s => s.clientId === id);
    if (clientSales.length > 0) {
        showAlert('No se puede eliminar el cliente porque tiene ventas asociadas', 'error');
        return;
    }
    
    if (confirm(`¿Está seguro de eliminar al cliente "${client.name}"?`)) {
        const clients = getClients().filter(c => c.id !== id);
        saveClients(clients);
        loadClientsTable();
        populateSaleSelects();
        updateDashboardStats();
        showAlert('Cliente eliminado correctamente', 'success');
    }
}

function generateReport() {
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
    const sales = getSales();
    const products = getProducts();
    const clients = getClients();
    
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
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(s => {
                        const client = clients.find(c => c.id === s.clientId);
                        return `
                            <tr>
                                <td>#${s.id.toString().padStart(4, '0')}</td>
                                <td>${client ? client.name : 'N/A'}</td>
                                <td>${s.date}</td>
                                <td>S/${s.total.toFixed(2)}</td>
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

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(section + '-section');
    if (target) target.classList.remove('hidden');
    
    if (section === 'dashboard') {
        updateDashboardStats();
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

function exportData() {
    const data = {
        products: getProducts(),
        clients: getClients(),
        sales: getSales(),
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `backup-sistema-ventas-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (confirm('¿Está seguro de importar los datos? Esto sobrescribirá la información actual.')) {
                if (data.products) localStorage.setItem('products', JSON.stringify(data.products));
                if (data.clients) localStorage.setItem('clients', JSON.stringify(data.clients));
                if (data.sales) localStorage.setItem('sales', JSON.stringify(data.sales));
                
                loadInitialData();
                showAlert('Datos importados correctamente', 'success');
            }
        } catch (error) {
            showAlert('Error al importar datos. Verifique el archivo.', 'error');
        }
    };
    reader.readAsText(file);
    
    event.target.value = '';
}