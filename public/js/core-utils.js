function fmtNum(num) {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return parseFloat(num).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const fmt = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);

function formatCurrency(input) {
    let value = input.value.replace(/[^0-9]/g, '');
    if (value === "") {
        input.value = "";
        return;
    }
    input.value = parseInt(value, 10).toLocaleString('en-US');
}

function formatCompact(num) {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 2 }).format(num);
}
