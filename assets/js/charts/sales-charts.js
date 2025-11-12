/**
 * SALES-CHARTS.JS - Satış Grafikleri
 */

import { safeConsole } from '../core/logger.js';
import { 
    getTopCategoryChart, setTopCategoryChart,
    getTopBrandChart, setTopBrandChart,
    getTopProductChart, setTopProductChart,
    getTopSalesPersonChart, setTopSalesPersonChart
} from './chart-manager.js';

/**
 * Top Kategori grafiğini render et
 */
export function renderTopCategoryChart(data) {
    const ctx = document.getElementById('topCategoryChart');
    if (!ctx) return;
    
    const existingChart = getTopCategoryChart();
    if (existingChart) {
        existingChart.destroy();
    }
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d[0]),
            datasets: [{
                label: 'Satış ($ - KDV Hariç)',
                data: data.map(d => d[1]),
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: false}
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
    
    setTopCategoryChart(chart);
}

/**
 * Top Marka grafiğini render et
 */
export function renderTopBrandChart(data) {
    const ctx = document.getElementById('topBrandChart');
    if (!ctx) return;
    
    const existingChart = getTopBrandChart();
    if (existingChart) {
        existingChart.destroy();
    }
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d[0]),
            datasets: [{
                label: 'Satış ($ - KDV Hariç)',
                data: data.map(d => d[1]),
                backgroundColor: 'rgba(56, 239, 125, 0.8)',
                borderColor: 'rgba(56, 239, 125, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: false}
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
    
    setTopBrandChart(chart);
}

/**
 * Top Ürün grafiğini render et
 */
export function renderTopProductChart(data) {
    const ctx = document.getElementById('topProductChart');
    if (!ctx) return;
    
    const existingChart = getTopProductChart();
    if (existingChart) {
        existingChart.destroy();
    }
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d[0].substring(0, 30) + (d[0].length > 30 ? '...' : '')),
            datasets: [{
                label: 'Satış ($ - KDV Hariç)',
                data: data.map(d => d[1]),
                backgroundColor: 'rgba(245, 87, 108, 0.8)',
                borderColor: 'rgba(245, 87, 108, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: false},
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return data[context[0].dataIndex][0];
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
    
    setTopProductChart(chart);
}

/**
 * Top Satış Temsilcisi grafiğini render et
 */
export function renderTopSalesPersonChart(data) {
    const ctx = document.getElementById('topSalesPersonChart');
    if (!ctx) return;
    
    const existingChart = getTopSalesPersonChart();
    if (existingChart) {
        existingChart.destroy();
    }
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d[0]),
            datasets: [{
                label: 'Satış ($ - KDV Hariç)',
                data: data.map(d => d[1]),
                backgroundColor: 'rgba(240, 147, 251, 0.8)',
                borderColor: 'rgba(240, 147, 251, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: false}
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
    
    setTopSalesPersonChart(chart);
}

