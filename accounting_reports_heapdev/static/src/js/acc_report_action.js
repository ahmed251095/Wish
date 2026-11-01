/** @odoo-module **/
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { Component, onWillStart, onMounted, markup, proxy, signal, useProps } from "@odoo/owl";
import { standardActionServiceProps } from "@web/webclient/actions/action_plugin";
import { accReportDom } from "./acc_report_common";

/* Odoo 20 (OWL 3) client action for the server rendered accounting reports. */
export class AccReportAction extends Component {
    static template = "accounting_reports_heapdev.AccReportAction";
    props = useProps(standardActionServiceProps);
    root = signal.ref();

    setup() {
        this.orm = useService("orm");
        this.actionService = useService("action");
        const params = (this.props.action && this.props.action.params) || {};
        this.options = Object.assign({report: params.report || "pl"}, params.options || {});
        this.state = proxy({html: markup(""), loading: true});
        onWillStart(() => this.load());
        onMounted(() => {
            const el = this.root();
            if (el) {
                el.addEventListener("input", (ev) => {
                    if (ev.target.classList.contains("o_acc_dd_search")) {
                        accReportDom.accFilterList(ev.target);
                    }
                });
            }
        });
    }

    async load() {
        this.state.loading = true;
        const res = await this.orm.call("acc.report.engine", "get_report_html", [this.options]);
        this.options = res.options;
        this.state.html = markup(res.html);
        this.state.loading = false;
    }

    onSubmit = (ev) => {
        ev.preventDefault();
    };

    onClick = async (ev) => {
        const root = this.root();
        const el = ev.target.closest("[data-acc]");
        if (!el) {
            const row = ev.target.closest("tr.o_acc_foldable");
            if (row && !ev.target.closest("a")) {
                accReportDom.accToggleRow(root, row);
            }
            return;
        }
        const act = el.dataset.acc;
        if (el.tagName === "A" || el.tagName === "BUTTON") {
            ev.preventDefault();
        }
        if (act === "fold") {
            accReportDom.accToggleRow(root, el.closest("tr"));
        } else if (act === "fold_all" || act === "unfold_all") {
            accReportDom.accFoldAll(root, act === "fold_all");
        } else if (act === "apply") {
            Object.assign(this.options, accReportDom.accCollectFilters(root));
            await this.load();
        } else if (act === "preset") {
            Object.assign(this.options, accReportDom.accCollectFilters(root), {preset: el.dataset.preset, date_from: false, date_to: false});
            await this.load();
        } else if (act === "drill") {
            const params = JSON.parse(el.dataset.params || "{}");
            const action = await this.orm.call("acc.report.engine", "action_drill", [this.options, params]);
            if (action) {
                await this.actionService.doAction(action);
            }
        } else if (act === "pdf") {
            const action = await this.orm.call("acc.report.engine", "action_print_pdf", [this.options]);
            await this.actionService.doAction(action);
        } else if (act === "xlsx") {
            window.location.href = accReportDom.accXlsxUrl(this.options);
        }
    };
}

registry.category("actions").add("acc_report_heapdev", AccReportAction);
