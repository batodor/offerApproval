sap.ui.define([
	"sap/ui/test/Opa5",
	"OfferApproval/OfferApproval/test/integration/arrangements/Arrangement",
	"OfferApproval/OfferApproval/test/integration/NavigationJourneyPhone",
	"OfferApproval/OfferApproval/test/integration/NotFoundJourneyPhone",
	"OfferApproval/OfferApproval/test/integration/BusyJourneyPhone"
], function (Opa5, Arrangement) {
	"use strict";

	Opa5.extendConfig({
		arrangements: new Arrangement(),
		viewNamespace: "OfferApproval.OfferApproval.view.",
		autoWait: true
	});
});
