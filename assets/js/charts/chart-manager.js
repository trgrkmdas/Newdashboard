/**
 * CHART-MANAGER.JS - Chart Instance Yönetimi
 */

// Chart instance'larını tutmak için global değişkenler
export let topCategoryChart = null;
export let topBrandChart = null;
export let topProductChart = null;
export let topSalesPersonChart = null;

// Dashboard chart instance'ları
export let dashYearlyChartInstance = null;
export let dashTopStoresChartInstance = null;
export let dashTopSalespeopleChartInstance = null;
export let dashTopBrandsChartInstance = null;
export let dashTopCategoriesChartInstance = null;
export let dashTopCitiesChartInstance = null;
export let dashTopProductsChartInstance = null;

/**
 * Chart instance'larını sıfırla
 */
export function resetCharts() {
    if (topCategoryChart) {
        topCategoryChart.destroy();
        topCategoryChart = null;
    }
    if (topBrandChart) {
        topBrandChart.destroy();
        topBrandChart = null;
    }
    if (topProductChart) {
        topProductChart.destroy();
        topProductChart = null;
    }
    if (topSalesPersonChart) {
        topSalesPersonChart.destroy();
        topSalesPersonChart = null;
    }
    
    // MEMORY LEAK FIX: Dashboard chart instance'larını da temizle
    if (dashYearlyChartInstance) {
        dashYearlyChartInstance.destroy();
        dashYearlyChartInstance = null;
    }
    if (dashTopStoresChartInstance) {
        dashTopStoresChartInstance.destroy();
        dashTopStoresChartInstance = null;
    }
    if (dashTopSalespeopleChartInstance) {
        dashTopSalespeopleChartInstance.destroy();
        dashTopSalespeopleChartInstance = null;
    }
    if (dashTopBrandsChartInstance) {
        dashTopBrandsChartInstance.destroy();
        dashTopBrandsChartInstance = null;
    }
    if (dashTopCategoriesChartInstance) {
        dashTopCategoriesChartInstance.destroy();
        dashTopCategoriesChartInstance = null;
    }
    if (dashTopCitiesChartInstance) {
        dashTopCitiesChartInstance.destroy();
        dashTopCitiesChartInstance = null;
    }
    if (dashTopProductsChartInstance) {
        dashTopProductsChartInstance.destroy();
        dashTopProductsChartInstance = null;
    }
    
    safeConsole.log('🧹 Tüm chart instance\'ları temizlendi');
}

/**
 * Chart instance setter'ları
 */
export function setTopCategoryChart(chart) {
    topCategoryChart = chart;
}

export function setTopBrandChart(chart) {
    topBrandChart = chart;
}

export function setTopProductChart(chart) {
    topProductChart = chart;
}

export function setTopSalesPersonChart(chart) {
    topSalesPersonChart = chart;
}

/**
 * Chart instance getter'ları
 */
export function getTopCategoryChart() {
    return topCategoryChart;
}

export function getTopBrandChart() {
    return topBrandChart;
}

export function getTopProductChart() {
    return topProductChart;
}

export function getTopSalesPersonChart() {
    return topSalesPersonChart;
}

/**
 * Dashboard chart instance setter'ları
 */
export function setDashYearlyChartInstance(chart) {
    dashYearlyChartInstance = chart;
}

export function setDashTopStoresChartInstance(chart) {
    dashTopStoresChartInstance = chart;
}

export function setDashTopSalespeopleChartInstance(chart) {
    dashTopSalespeopleChartInstance = chart;
}

export function setDashTopBrandsChartInstance(chart) {
    dashTopBrandsChartInstance = chart;
}

export function setDashTopCategoriesChartInstance(chart) {
    dashTopCategoriesChartInstance = chart;
}

export function setDashTopCitiesChartInstance(chart) {
    dashTopCitiesChartInstance = chart;
}

export function setDashTopProductsChartInstance(chart) {
    dashTopProductsChartInstance = chart;
}

/**
 * Dashboard chart instance getter'ları
 */
export function getDashYearlyChartInstance() {
    return dashYearlyChartInstance;
}

export function getDashTopStoresChartInstance() {
    return dashTopStoresChartInstance;
}

export function getDashTopSalespeopleChartInstance() {
    return dashTopSalespeopleChartInstance;
}

export function getDashTopBrandsChartInstance() {
    return dashTopBrandsChartInstance;
}

export function getDashTopCategoriesChartInstance() {
    return dashTopCategoriesChartInstance;
}

export function getDashTopCitiesChartInstance() {
    return dashTopCitiesChartInstance;
}

export function getDashTopProductsChartInstance() {
    return dashTopProductsChartInstance;
}

// MEMORY LEAK FIX: Sayfa kapatıldığında tüm chart'ları temizle (sadece bir kez ekle)
if (typeof window !== 'undefined' && !window.chartManagerCleanupAdded) {
    window.addEventListener('beforeunload', () => {
        resetCharts();
    });
    window.chartManagerCleanupAdded = true;
}

