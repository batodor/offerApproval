// We cannot provide stable mock data out of the template.
// If you introduce mock data, by adding .json files in your webapp/localService/mockdata folder you have to provide the following minimum data:
// * At least 3 Workitems in the list
// * All 3 Workitems have at least one TCHeaders

sap.ui.define([
	"sap/ui/test/Opa5",
	"OfferApproval/OfferApproval/test/integration/arrangements/Arrangement","OfferApproval/OfferApproval/test/integration/MasterJourney",
	"OfferApproval/OfferApproval/test/integration/NavigationJourney",
	"OfferApproval/OfferApproval/test/integration/NotFoundJourney",
	"OfferApproval/OfferApproval/test/integration/BusyJourney",
	"OfferApproval/OfferApproval/test/integration/FLPIntegrationJourney"
], function (Opa5, Arrangement) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Arrangement(),
		viewNamespace: "OfferApproval.OfferApproval.view.",
		autoWait: true
	});
});
