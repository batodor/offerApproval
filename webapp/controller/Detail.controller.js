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
				
				this.forwardDialog = sap.ui.xmlfragment("fragment.forwardDialog", this);
				this.getView().addDependent(this.forwardDialog);
				
				this.approvalDialog = sap.ui.xmlfragment("fragment.approvalDialog", this);
				this.getView().addDependent(this.approvalDialog);
				
				this.typeArr = ["text", "value", "dateValue", "selectedKey", "selected", "state", "tokens"];
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
					this.setInput(["mainDeleteButton", "mainEditButton"], true, "Visible");
					this.setInput(["mainApproveButton", "mainRejectButton", "mainForwardButton"], false, "Visible");
				}else{
					this.setInput(["mainDeleteButton", "mainEditButton"], false, "Visible");
					this.setInput(["mainApproveButton", "mainRejectButton", "mainForwardButton"], true, "Visible");
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
				var settings = {
					path : sObjectPath,
					events: {
						change : this._onBindingChange.bind(this),
						dataRequested : function () {
							oViewModel.setProperty("/busy", true);
						},
						dataReceived: this.dataReceived.bind(this)
					}
				};
				if(this.objectId){
					settings.parameters = {
						custom: { WorkitemID: this.objectId }
					};
				}
				this.getView().bindElement(settings);
				
				// this.byId('offerProductText').bindElement(sObjectPath);
				//this.byId('offerProductText').bindProperty("text", { path: sObjectPath + "/ProductName" });
			},
			
			dataReceived: function(oEvent){
				this.getModel("detailView").setProperty("/busy", false);
				var data = oEvent.getParameters("data").data;
				if(data.Status === "1" && this.type){
					this.byId("mainRecallButton").setVisible(true);
				}else{
					this.setInput(["mainRecallButton"], false, "Visible");
				} 
				if(data.Status === "2" && this.type){
					this.byId("mainDoneButton").setVisible(true);
				}else{
					this.setInput(["mainDoneButton"], false, "Visible");
				}
				if(data.Status !== "0" && this.type){
					this.byId("mainExecuteButton").setVisible(true);
				}else{
					this.byId("mainExecuteButton").setVisible(false);
				}
				if(!(data.Status === "1" || data.Status === "6" || data.Status === "7") && this.type){
					this.byId("mainApprovalButton").setVisible(true);
				}else{
					this.byId("mainApprovalButton").setVisible(false);
				}
				if(data.ApprForAllPossible){
					this.byId("mainFinalApproveButton").setVisible(true);
				}else{
					this.byId("mainFinalApproveButton").setVisible(false);
				}
				var oModel = new JSONModel(data); // Only set data here.
				this.getView().setModel(oModel, "header"); // set the alias here
			},
			
			changeOfferStatus: function(oEvent){
				var id = oEvent.getSource().data("id");
				var oFuncParams = {
					TCNumber: this.TCNumber,
					Status: id
				};
				this.getModel().callFunction("/ChangeOfferStatus", {
					method: "POST",
					urlParameters: oFuncParams,
					success: this.onChangeStatusSuccess.bind(this, "ChangeOfferStatus")
				});
			},
			onChangeStatusSuccess: function(link, oData) {
				var oResult = oData[link];
				if (oResult.ActionSuccessful) {
					MessageToast.show(oResult.Message);
				} else {
					MessageBox.error(oResult.Message);
				}
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
					oObject = oView.getModel().getObject(sPath);
					
				if(oObject){
					var sObjectId = oObject.TCNumber;
					var sObjectName = oObject.CounterpartyName;
					var oViewModel = this.getModel("detailView");

					this.getOwnerComponent().oListSelector.selectAListItem(sPath);
	
					oViewModel.setProperty("/saveAsTileTitle",oResourceBundle.getText("shareSaveTileAppTitle", [sObjectName]));
					oViewModel.setProperty("/shareOnJamTitle", sObjectName);
					oViewModel.setProperty("/shareSendEmailSubject",
						oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
					oViewModel.setProperty("/shareSendEmailMessage",
						oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
				}
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
				var settings = {};
				if(this.type){
					settings.type = this.type;      
				}
				this.getRouter().navTo("master", settings);
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
			
			approveReject: function(oEvent){
				var id = oEvent.getSource().data("id");
				var dialog = this["approveDialog"];
				var button = this.byId("approveButton") || sap.ui.getCore().byId("approveButton");
				var text = id === "reject" ? this.getResourceBundle().getText("reject") : this.getResourceBundle().getText("approve");
				button.data("id", id);
				button.setText(text);
				dialog.setTitle(text);
				dialog.open();
			},
			
			dialogCancel: function(oEvent){
				var id = oEvent.getSource().data("id");
				this[id].close();
			},
			dialogApprove: function(oEvent){
				var id = oEvent.getSource().data("id");
				var link = id === "approve" ? "ApproveOffer" : "RejectOffer";
				var all = oEvent.getSource().data("all");
				var oFuncParams = { 
					WorkitemID: this.objectId,
					Comment: sap.ui.getCore().byId("approveComment").getValue(),
					ForAll: all ? true : false
				};
				this.getModel().callFunction("/" + link, {
					method: "POST",
					urlParameters: oFuncParams,
					success: this.onApproveRejectSuccess.bind(this, link)
				});
			},
			dialogApproval: function(oEvent){
				var uploadItems = sap.ui.getCore().byId("approvalUpload").getSelectedItems();
				var attachList = '';
				for(var i = 0; i < uploadItems.length; i++){
					attachList = attachList + this.getModel().getData(uploadItems[i].getBindingContextPath()).FileGUID + ";";
				}
				if(attachList){
					attachList = attachList.slice(0,-1);
				}
				var dUTCDate = sap.ui.getCore().byId("approvalValidityDateTime").getDateValue();
				// Consider selected date as UTC date
				dUTCDate.setMinutes(dUTCDate.getMinutes() + (-dUTCDate.getTimezoneOffset()));
				var oFuncParams = { 
					TCNumber: this.TCNumber,
					Comment: sap.ui.getCore().byId("approvalComment").getValue(),
					ValidityDate: dUTCDate,
					ValidityTimeZone: sap.ui.getCore().byId("approvalValidityTimeZone").getSelectedKey(),
					AttachList: attachList,
					GlobalTrader: sap.ui.getCore().byId("approvalTrader").getSelectedKey()
				};
				this.getModel().callFunction("/SentOfferToApproval", {
					method: "POST",
					urlParameters: oFuncParams,
					success: this.onApprovalSuccess.bind(this, "SentOfferToApproval")
				});
			},
			onApprovalSuccess: function(link, oData) {
				var oResult = oData[link];
				if (oResult.ActionSuccessful) {
					MessageToast.show(oResult.Message);
					this.getModel().refresh(true);
					this.approvalDialog.close();
				} else {
					MessageBox.error(oResult.Message);
				}
			},
			
			onApproveRejectSuccess: function(link, oData) {
				var oResult = oData[link];
				if (oResult.ActionSuccessful) {
					MessageToast.show(oResult.Message);
					var oDialog = this.approveDialog;
					oDialog.close();
					this.getRouter().navTo("master", { type: "" });
					// Refresh Master list data
					this.getOwnerComponent().byId("master").getController()._oList.getBinding("items").refresh();
				} else {
					MessageBox.error(oResult.Message);
				}
			},
			
			forward: function(oEvent){
				var id = oEvent.getSource().data("id");
				this[id + "Dialog"].open();
			},
			dialogForward: function(oEvent){
				var oFuncParams = { 
					WorkitemID: this.objectId,
					Comment: sap.ui.getCore().byId("forwardComment").getValue(),
					ForwardToUser: sap.ui.getCore().byId("forwardTrader").getSelectedKey()
				};
				this.getModel().callFunction("/ForwardOffer", {
					method: "POST",
					urlParameters: oFuncParams,
					success: this.onForwardSuccess.bind(this, "ForwardOffer")
				});
			},
			onForwardSuccess: function(link, oData){
				var oResult = oData[link];
				if (oResult.CopyingSuccessfully) {
					MessageToast.show(oResult.Message);
				} else {
					MessageBox.error(oResult.Message);
				}
			},
			
			// Enable/Disables inputs depending flag arg
			// idArr can be array of strings as well as objects
			setInput: function(idArr, flag, func){
				var evalStr = 'input.set' + func + '(flag)';
				for(var i = 0; i < idArr.length; i++){
					var input = null;
					if(typeof idArr[i] === "string"){
						input = this.byId(idArr[i]) || sap.ui.getCore().byId(idArr[i]);
					}else if(typeof idArr[i] === "object"){
						input = idArr[i];
					}
					if(input){
						eval(evalStr);
					}
				}
			},
			
			delete: function(oEvent){
				var that = this;
				var model = this.getModel();
				MessageBox.confirm(that.getResourceBundle().getText("askDelete"), {
					actions: [that.getResourceBundle().getText("delete"), sap.m.MessageBox.Action.CLOSE],
					onClose: function(sAction) {
						if (sAction === that.getResourceBundle().getText("delete")) {
							model.remove("/offerHeaderSet('" + that.TCNumber + "')",{
								success: function(){
									MessageToast.show("Delete successful!");
									that.onCloseDetailPress();
								}
							});
						} else {
							MessageToast.show("Delete canceled!");
						}
					}
				});
			},
			
			edit: function(){
				window.open("/sap/bc/ui2/flp#ZTS_OFFER-change&/" + this.TCNumber);
			},
			
			copy: function(oEvent){
				var oFuncParams = { 
					OfferNumber: this.TCNumber
				};
				this.getModel().callFunction("/CopyOfferToTradingContract", {
					method: "POST",
					urlParameters: oFuncParams,
					success: this.onCopySuccess.bind(this, "CopyOfferToTradingContract")
				});
			},
			onCopySuccess: function(link, oData) {
				var oResult = oData[link];
				if (oResult.CopyingSuccessfully) {
					MessageToast.show(oResult.Message);
				} else {
					MessageBox.error(oResult.Message);
				}
			},
			
			// Set odata from any dialog, argument object = any object / return object inputs Data
			getData: function(object){
				var oData = {};
				var inputs = this.getInputs(object);
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					if(input["sId"].indexOf('hbox') > -1){
						var vboxes = input.getItems();
						for(var j = 0; j < vboxes.length; j++){
							oData = this.mergeObjects(oData, this.getDataInner(vboxes[j].getItems()[1]));
						}
					}else{
						oData = this.mergeObjects(oData, this.getDataInner(input));
					}
				}
				return oData;
			},
			getDataInner: function(input){
				var oData = {};
				for(var j = 0; j < this.typeArr.length; j++){
					var type = this.typeArr[j];
					if(input.getBindingInfo(type) && !input.data("omit")){
						var value;
						if(type === "tokens"){
							var tokens = input.getTokens();
							value = [];
							for(var l = 0; l < tokens.length; l++){
								var token = {};
								token.Name = tokens[l].getText();
								token.Code = tokens[l].getKey();
								value.push(token);
							}
						}else{
							value = input.getProperty(type);
						}
						if(input.data("data")){
							value = input.data("data");
						}
						
						var name = input.getBindingInfo(type).binding.sPath;
						
						// Set default value(placeholder) if value is not defined
						if(!value && input["mProperties"].hasOwnProperty("placeholder")){
							value = input["mProperties"].placeholder;
						}
						
						if(input.data("string")){
							value = value.toString();
						}
						
						// If inputs name is not defined
						if(input.data("name")){
							name = input.data("name");
						}
						
						// Remove offset for dates
						if(input.hasOwnProperty("_oMaxDate")){
							value = input.getDateValue();
							if(value) {
								value.setMinutes(-value.getTimezoneOffset());
							} else { 
								value = null;
							}
						}
						oData[name] = value;
					}
				}
				return oData;
			},
			
			getVolumeData: function(){
				var oData = {};
				oData = {};
				var list = this.byId("volumesList");
				var volumes = list.getItems();
				oData.ToOfferVolume = [];
				for(var i = 0; i < volumes.length; i++){
					var volumeName = this.getData(volumes[i].getContent()[0].getHeaderToolbar());
					var volumeData = this.getData(volumes[i].getContent()[0].getContent()[0]);
					var allVolumeData = this.mergeObjects(volumeName, volumeData);
					
					var periods = volumes[i].getContent()[0].getContent()[2].getItems();
					allVolumeData.ToOfferPeriod = [];
					for(var j = 0; j < periods.length; j++){
						var period = periods[j].getContent()[0].getContent()[0];
						var periodData = this.getData(period);
						allVolumeData.ToOfferPeriod.push(periodData);
					}
					oData.ToOfferVolume.push(allVolumeData);
				}
				return oData;
			},
			
			collectLimitsData: function(){
				var oData = {};
				// var offerData = this.getData(["pageOfferDetails"]);
				// oData.Partners = this.TCNumber;
				// oData.CompanyCode = offerData.CompanyBranch;
				// oData.PaymentMethod = offerData.PaymentMethod;
				// oData.PaymentTerm = offerData.PaymentTerm;
				
				var volumeData = this.getVolumeData();
				var DateFrom = null;
				var DateTo = null;
				var oneDay = 24*60*60*1000;
				var Tonnage = 0;
				for(var i = 0; i < volumeData.ToOfferVolume.length; i++){
					for(var j = 0; j < volumeData.ToOfferVolume[i].ToOfferPeriod.length; j++){
						var period = volumeData.ToOfferVolume[i].ToOfferPeriod[j];
						if(DateFrom){
							DateFrom = period.DateFrom < DateFrom ? period.DateFrom : DateFrom;
						}else{
							DateFrom = period.DateFrom;
						}
						if(DateTo){
							DateTo = period.DateTo > DateTo ? period.DateTo : DateTo;
						}else{
							DateTo = period.DateTo;
						}
						Tonnage = Tonnage + parseInt(period.TonnageMax);
					}
				}
				var Period = Math.round(Math.abs((DateFrom - DateTo)/(oneDay)));
				oData.Period = Period;
				oData.Tonnage = Tonnage;
				oData.TCNumber = this.TCNumber;
				return oData;
			},
			
			checkLimits: function(){
				var oFuncParams = this.collectLimitsData();
				this.getModel().callFunction("/CheckValidityLimits", {
					method: "GET",
					urlParameters: oFuncParams,
					success: this.onCheckLimitsSuccess.bind(this, "CheckValidityLimits")
				});
			},
			onCheckLimitsSuccess: function(link, oData) {
				var oResult = oData[link];
				this.byId("limitPaymentConditionIcon").setColor(oResult.PaymentExceed ? "red" : "green").setSrc(oResult.PaymentExceed ? 'sap-icon://alert' : 'sap-icon://accept');
				this.byId("limitPeriodIcon").setColor(oResult.PeriodExceed ? "red" : "green").setSrc(oResult.PeriodExceed ? 'sap-icon://alert' : 'sap-icon://accept');
				this.byId("limitTonnageIcon").setColor(oResult.TonnageExceed ? "red" : "green").setSrc(oResult.TonnageExceed ? 'sap-icon://alert' : 'sap-icon://accept');
				this.byId("limitPaymentCondition").setText(oResult.PaymentCondition ? oResult.PaymentCondition : this.getResourceBundle().getText("worklistTableTitle"));
				this.byId("limitPeriod").setText(oResult.Period + " " + oResult.PeriodUoM);
				this.byId("limitTonnage").setText(oResult.Tonnage + " " + oResult.TonnageUoM);
				
				if(oResult.PaymentExceed || oResult.PeriodExceed || oResult.TonnageExceed){
					this.byId("requestLimit").setEnabled(true);
				}else{
					this.byId("requestLimit").setEnabled(false);
				}
			},
			
			// Object.assign doesnt work in IE so this function is created
			mergeObjects: function(objOne, objTwo){
				var objs = [objOne, objTwo],
			    result =  objs.reduce(function (r, o) {
			        Object.keys(o).forEach(function (k) {
			            r[k] = o[k];
			        });
			        return r;
			    }, {});
			    return result;
			},
			
			// Gete inputs from array of ids or directly from object
			getInputs: function(object){
				var inputs = [];
				if(Array.isArray(object)){
					for(var i = 0; i < object.length; i++){
						var obj = this.byId(object[i]) || sap.ui.getCore().byId(object[i]);
						var objInputs = obj.getAggregation("content") || obj.getAggregation("items");
						inputs = inputs.concat(objInputs);
					}
				}else{
					inputs = object.getAggregation("content") || object.getAggregation("items");
				}
				return inputs;
			},
			
			onPeriodsFinished: function(oEvent){
				// this.checkLimits();
			}

		});

	}
);