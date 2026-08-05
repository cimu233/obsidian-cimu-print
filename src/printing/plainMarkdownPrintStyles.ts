export const PLAIN_MARKDOWN_PRINT_STYLES = `
@media print {
    html,
    body,
    .cimu-print {
        color-scheme: light !important;
        background: #fff !important;
        color: #000 !important;
    }

    .cimu-print,
    .cimu-print * {
        color: #000 !important;
        border-color: #777 !important;
        text-shadow: none !important;
        box-shadow: none !important;
    }

    .cimu-print :where(div, section, article, aside, header, footer, nav, p, span, li, dl, dt, dd, blockquote, table, thead, tbody, tfoot, tr, td, th) {
        background-color: transparent !important;
        background-image: none !important;
    }

    .cimu-print a {
        color: #000 !important;
        text-decoration: underline !important;
        text-decoration-thickness: 1px !important;
        text-underline-offset: 2px !important;
    }

    .cimu-print mark {
        background: #fff !important;
        border-bottom: 2px solid #000 !important;
    }

    .cimu-print pre,
    .cimu-print :not(pre) > code,
    .cimu-print th {
        background: #f2f2f2 !important;
    }

    .cimu-print .callout {
        --callout-color: 0, 0, 0 !important;
        background: #fff !important;
        border: 1px solid #777 !important;
        border-left: 4px solid #000 !important;
    }

    .cimu-print .callout-title,
    .cimu-print .callout-icon,
    .cimu-print .callout-fold {
        color: #000 !important;
    }

    .cimu-print .cimu-print-frontmatter,
    .cimu-print .cimu-print-frontmatter-object,
    .cimu-print .cimu-print-frontmatter-chip {
        background: #fff !important;
        border-color: #777 !important;
    }

    .cimu-print svg {
        filter: grayscale(1) !important;
    }
}
`;
