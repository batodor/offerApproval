/*global location */
sap.ui.define([
		"OfferApproval/OfferApproval/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"OfferApproval/OfferApproval/model/formatter",
		'sap/m/MessageToast',
		'sap/m/MessageBox'
	], function (BaseController, JSONModel, formatter, MessageToast, MessageBox) {
		"use strict";

		return BaseController.extend("OfferApproval.OfferApproval.controller.Detail", {

			formatter: formatter,

			/* =========================================================== */
			/* lifecycle methods                                           */
			/* =========================================================== */

			onInit : function () {
				// Model used to manipulate control states. The chosen values make sure,
				// detail page is busy indication immediately so there is no break in
				// between the busy indication for loading the view's meta data
				var oViewModel = new JSONModel({
					busy : false,
					delay : 0,
					lineItemListTitle : this.getResourceBundle().getText("detailLineItemTableHeading")
				});

				this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

				this.setModel(oViewModel, "detailView");

				this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
				
				this.approveDialog = sap.ui.xmlfragment("fragment.approveDialog", this);
				this.getView().addDependent(this.approveDialog);
			},

			/* =========================================================== */
			/* event handlers                                              */
			/* =========================================================== */

			/**
			 * Updates the item count within the line item table's header
			 * @param {object} oEvent an event containing the total number of items in the list
			 * @private
			 */
			onListUpdateFinished : function (oEvent) {
				var sTitle,
					iTotalItems = oEvent.getParameter("total"),
					oViewModel = this.getModel("detailView");

				// only update the counter if the length is final
				if (this.byId("lineItemsList").getBinding("items").isLengthFinal()) {
					if (iTotalItems) {
						sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
					} else {
						//Display 'Line Items' instead of 'Line items (0)'
						sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
					}
					oViewModel.setProperty("/lineItemListTitle", sTitle);
				}
			},

			/* =========================================================== */
			/* begin: internal methods                                     */
			/* =========================================================== */

			/**
			 * Binds the view to the object path and expands the aggregated line items.
			 * @function
			 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
			 * @private
			 */
			_onObjectMatched : function (oEvent) {
				this.objectId =  oEvent.getParameter("arguments").objectId;
				this.TCNumber =  oEvent.getParameter("arguments").TCNumber;
				this.type =  oEvent.getParameter("arguments").type;
				this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
				this.getModel().metadataLoaded().then( function() {
					var sObjectPath = this.getModel().createKey("/workitemHeaderSet", {
						TCNumber: this.TCNumber
					});
					this._bindView(sObjectPath);
				}.bind(this));
				if(this.type){
					this.byId("mainDeleteButton").setVisible(true);
					this.byId("mainCopyButton").setVisible(true);
					this.byId("mainEditButton").setVisible(true);
				}else{
					
					this.byId("mainApproveButton").setVisible(true);
					this.byId("mainRejectButton").setVisible(true);
					this.byId("mainForwardButton").setVisible(true);
				}
			},

			/**
			 * Binds the view to the object path. Makes sure that detail view displays
			 * a busy indicator while data for the corresponding element binding is loaded.
			 * @function
			 * @param {string} sObjectPath path to the object to be bound to the view.
			 * @private
			 */
			_bindView : function (sObjectPath) {
				// Set busy indicator during view binding
				var oViewModel = this.getModel("detailView");

				// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
				oViewModel.setProperty("/busy", false);

				this.getView().bindElement({
					path : sObjectPath,
					events: {
						change : this._onBindingChange.bind(this),
						dataRequested : function () {
							oViewModel.setProperty("/busy", true);
						},
						dataReceived: function () {
							oViewModel.setProperty("/busy", false);
						}
					}
				});
			},

			_onBindingChange : function () {
				var oView = this.getView(),
					oElementBinding = oView.getElementBinding();

				// No data for the binding
				if (!oElementBinding.getBoundContext()) {
					this.getRouter().getTargets().display("detailObjectNotFound");
					// if object could not be found, the selection in the master list
					// does not make sense anymore.
					this.getOwnerComponent().oListSelector.clearMasterListSelection();
					return;
				}

				var sPath = oElementBinding.getPath(),
					oResourceBundle = this.getResourceBundle(),
					oObject = oView.getModel().getObject(sPath),
					sObjectId = oObject.WorkitemID,
					sObjectName = oObject.Customer,
					oViewModel = this.getModel("detailView");

				this.getOwnerComponent().oListSelector.selectAListItem(sPath);

				oViewModel.setProperty("/saveAsTileTitle",oResourceBundle.getText("shareSaveTileAppTitle", [sObjectName]));
				oViewModel.setProperty("/shareOnJamTitle", sObjectName);
				oViewModel.setProperty("/shareSendEmailSubject",
					oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
				oViewModel.setProperty("/shareSendEmailMessage",
					oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
			},

			_onMetadataLoaded : function () {
				// Store original busy indicator delay for the detail view
				var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
					oViewModel = this.getModel("detailView");

				// Make sure busy indicator is displayed immediately when
				// detail view is displayed for the first time
				oViewModel.setProperty("/delay", 0);
				oViewModel.setProperty("/lineItemTableDelay", 0);

				// Binding the view will set it to not busy - so the view is always busy if it is not bound
				oViewModel.setProperty("/busy", true);
				// Restore original busy indicator delay for the detail view
				oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
			},

			/**
			 * Set the full screen mode to false and navigate to master page
			 */
			onCloseDetailPress: function () {
				this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
				// No item should be selected on master after detail page is closed
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				this.getRouter().navTo("master");
			},

			/**
			 * Toggle between full and non full screen mode.
			 */
			toggleFullScreen: function () {
				var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/fullScreen");
				this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
				if (!bFullScreen) {
					// store current layout and go full screen
					this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
					this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");
				} else {
					// reset to previous layout
					this.getModel("appView").setProperty("/layout",  this.getModel("appView").getProperty("/previousLayout"));
				}
			},
			
			reject: function(oEvent){
				var id = oEvent.getSource().data("id");
				var dialog = this[id];
				var text = sap.ui.getCore().byId("approveText");
				var created = this.getView().getBindingContext().getProperty("CreatedByName");
				text.setText("Reject the offer contract submitted by " + created + "?");
				dialog.setTitle("Reject Offer");
				dialog.open();
			},
			
			approve: function(oEvent){
				var id = oEvent.getSource().data("id");
				this[id + "Dialog"].open();
			},
			
			dialogCancel: function(oEvent){
				var id = oEvent.getSource().data("id");
				this[id].close();
			},
			dialogApprove: function(oEvent){
				var uploadItems = sap.ui.getCore().byId("approveUpload").getSelectedItems();
				var attachList = '';
				for(var i = 0; i < uploadItems.length; i++){
					attachList = attachList + this.getModel().getData(uploadItems[i].getBindingContextPath()).FileGUID + ";";
				}
				attachList = attachList.slice(0,-1);
				var oFuncParams = { 
					TCNumber: this.TCNumber,
					Comment: sap.ui.getCore().byId("approveComment").getValue(),
					ValidityDate: sap.ui.getCore().byId("approveValidityDate").getDateValue(),
					Trader: sap.ui.getCore().byId("approveTrader").getSelectedKey(),
					AttachList: attachList
				};
				console.log(oFuncParams);
				this.getModel().callFunction("/SentOfferToApproval", {
					method: "POST",
					urlParameters: oFuncParams,
					success: this.onApproveSuccess.bind(this, "SentOfferToApproval")
				});
			},
			onApproveSuccess: function(link, oData) {
				var oResult = oData[link];
				if (oResult.ActionSuccessful) {
					MessageToast.show(oResult.Message);
				} else {
					MessageBox.error(oResult.Message);
				}
			}

		});

	}
);