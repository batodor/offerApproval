/*global location */
sap.ui.define([
		"OfferApproval/OfferApproval/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"OfferApproval/OfferApproval/model/formatter",
		"sap/m/MessageToast",
		"sap/m/MessageBox",
		"sap/ui/model/Filter",
		"sap/ui/model/FilterOperator"
	], function (BaseController, JSONModel, formatter, MessageToast, MessageBox, Filter, FilterOperator) {
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
				this.isRisk = {};
				
				//sap.ui.getCore().byId("approvalValidityDateTime").setInitialFocusedDateValue(new Date(new Date(new Date().setMinutes(0)).setSeconds(0)));
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
					this.setInput(["mainApproveButton", "mainRejectButton"], false, "Visible");
				}else{
					this.setInput(["mainDeleteButton", "mainEditButton"], false, "Visible");
					this.setInput(["mainApproveButton", "mainRejectButton"], true, "Visible");
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
					templateShareable: false,
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
				this.isBlacklist = false;
				this.getView().bindElement(settings);
			},
			
			dataReceived: function(oEvent){
				this.getModel("detailView").setProperty("/busy", false);
				var data = oEvent.getParameters("data").data;
				var oModel = new JSONModel(data); // Only set data here.
				this.getView().setModel(oModel, "header"); // set the alias here
				this.setDataByStatus(data);
			},
			
			setDataByStatus: function(data){
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
				if(!(data.Status === "0" || data.Status === "7") && this.type){
					this.byId("mainExecuteButton").setVisible(true);
				}else{
					this.byId("mainExecuteButton").setVisible(false);
				}
				if(!(data.Status === "1" || data.Status === "2" || data.Status === "6" || data.Status === "7") && this.type){
					this.byId("mainApprovalButton").setVisible(true);
				}else{
					this.byId("mainApprovalButton").setVisible(false);
				}
				if(data.ApprForAllPossible){
					this.byId("mainFinalApproveButton").setVisible(true);
				}else{
					this.byId("mainFinalApproveButton").setVisible(false);
				}
				// if(data.Status === "6" && this.type){
				// 	this.byId("mainCreateDealButton").setVisible(true);
				// }else{
				// 	this.byId("mainCreateDealButton").setVisible(false);
				// }
				if(this.type){
					this.byId("mainCopyButton").setVisible(true);
				}else{
					this.byId("mainCopyButton").setVisible(false);
				}
				this.data = data;
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
					this.getModel().refresh(true);
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
					this.setDataByStatus(oObject);
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
			
			approveReject: function(oEvent){
				var id = oEvent.getSource().data("id");
				var dialog = this["approveDialog"];
				var button = this.byId("approveButton") || sap.ui.getCore().byId("approveButton");
				var title = this.getResourceBundle().getText("reject");
				var text = this.getResourceBundle().getText("enterComments");
				if(id === "reject"){
					text = this.getResourceBundle().getText("rejectText");
				}
				if(id === "approve"){
					title = this.getResourceBundle().getText("approve"); 
				}else if(id === "final"){
					title = this.getResourceBundle().getText("finalApproval");
				}
				sap.ui.getCore().byId("approveText").setText(text);
				var buttonText = id === "approve" || id === "final" ? buttonText = this.getResourceBundle().getText("approve") : this.getResourceBundle().getText("reject");
				button.data("id", id);
				button.data("all", oEvent.getSource().data("all"));
				button.setText(buttonText);
				dialog.setTitle(title);
				if(oEvent.getSource().data("all")){
					sap.ui.getCore().byId("finalApprovalHBox").setVisible(false);
					sap.ui.getCore().byId("finalApprovalText").setVisible(true);
				}else{
					sap.ui.getCore().byId("finalApprovalHBox").setVisible(true);
					sap.ui.getCore().byId("finalApprovalText").setVisible(false);
				}
				sap.ui.getCore().byId("approveComment").setValue("");
				dialog.open();
			},
			
			dialogCancel: function(oEvent){
				var id = oEvent.getSource().data("id");
				this[id].close();
			},
			dialogApprove: function(oEvent){
				var id = oEvent.getSource().data("id");
				var link = id === "approve" || id === "final" ? "ApproveOffer" : "RejectOffer";
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
				var validityDate = sap.ui.getCore().byId("approvalValidityDateTime").getDateValue();
				if(validityDate && validityDate instanceof Date){
					var uploadItems = sap.ui.getCore().byId("approvalUpload").getSelectedItems();
					var attachList = '';
					for(var i = 0; i < uploadItems.length; i++){
						attachList = attachList + this.getModel().getData(uploadItems[i].getBindingContextPath()).FileGUID + ";";
					}
					if(attachList){
						attachList = attachList.slice(0,-1);
					}
					// Consider selected date as UTC date
					validityDate.setMinutes(validityDate.getMinutes() + (-validityDate.getTimezoneOffset()));
					var oFuncParams = { 
						TCNumber: this.TCNumber,
						Comment: sap.ui.getCore().byId("approvalComment").getValue(),
						ValidityDate: validityDate,
						ValidityTimeZone: sap.ui.getCore().byId("approvalValidityTimeZone").getSelectedKey(),
						AttachList: attachList,
						GlobalTrader: sap.ui.getCore().byId("approvalTrader").getSelectedKey()
					};
					this.getModel().callFunction("/SentOfferToApproval", {
						method: "POST",
						urlParameters: oFuncParams,
						success: this.onApprovalSuccess.bind(this, "SentOfferToApproval")
					});
				}else{
					this.alert(this.getResourceBundle().getText("validityDateAlert"));
				}
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
					this.getModel().refresh();
					// Refresh Master list data
					this.getOwnerComponent().byId("master").getController()._oList.getBinding("items").refresh();
				} else {
					MessageBox.error(oResult.Message);
				}
			},
			
			forward: function(oEvent){
				var id = oEvent.getSource().data("id");
				if(id === "approval"){
					var check = "";
					var checkArr = ["tradingPurpose", "product", "paymentMethod", "paymentTerm", "meansOfTransport"];
					for(var i = 0; i < checkArr.length; i++){
						if(!this.data[checkArr[i].charAt(0).toUpperCase() + checkArr[i].slice(1)]){
							check = check + this.getResourceBundle().getText(checkArr[i]) + "\n ";
						}
					}
					if(this.byId("volumesList").getItems().length === 0){
						check = check + this.getResourceBundle().getText("volume") + ", ";
					}
					if(check || this.isBlacklist){
						if(check){
							check = this.getResourceBundle().getText("plsFillIn") + " \n\n " + check.slice(0,-2);
							if(this.isBlacklist){
								check = check + "\n\n" + this.getResourceBundle().getText("counterpartyBlacklisted");
							}
						}else{
							check = this.getResourceBundle().getText("counterpartyBlacklisted");
						}
						this.alert(check);
						return true;
					}
					sap.ui.getCore().byId("approvalValidityTimeZone").setSelectedKey("YG" + (new Date().getTimezoneOffset() / 60));
				}
				sap.ui.getCore().byId("approvalUpload").selectAll();
				sap.ui.getCore().byId("approvalComment").setValue("");
				if(this.data.AgentIsApprover){
					sap.ui.getCore().byId("approvalTrader").setSelectedKey(sap.ushell.Container.getService("UserInfo").getUser().getId());
				}else{
					sap.ui.getCore().byId("approvalTrader").setSelectedKey("");
				}
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
				if (oResult.ActionSuccessful) {
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
									var eventBus = sap.ui.getCore().getEventBus();
									eventBus.publish("DetailMasterChannel", "onApproveEvent");
									
									MessageToast.show(that.getResourceBundle().getText("successfullyDeleted"));
									that.onCloseDetailPress();
								}
							});
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
			getData: function(object, isSave){
				var oData = {};
				var inputs = this.getInputs(object);
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					if(input["sId"].indexOf('hbox') > -1){
						var vboxes = input.getItems();
						for(var j = 0; j < vboxes.length; j++){
							oData = this.mergeObjects(oData, this.getDataInner(vboxes[j].getItems()[1], isSave));
						}
					}else{
						oData = this.mergeObjects(oData, this.getDataInner(input, isSave));
					}
				}
				return oData;
			},
			getDataInner: function(input, isSave){
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
								if(isSave){
									value.setMinutes(-value.getTimezoneOffset());
								}
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
			
			// oData = object with data, keyArr is array of keys to check
			checkDataInner: function(oData, keyArr){
				var check = "";
				for(var key in oData){
					if(keyArr.indexOf(key) > -1 ){
						if(!oData[key] || oData[key] === "0" || oData[key] === "0.00"){
							check = check + key + ",";
						}
					}
				}
				if(check){
					check = check.slice(0,-1);
				}
				return check;
			},
			
			collectLimitsData: function(data){
				var oData = {};
				oData.Partners = this.getPartnerList();
				oData.CompanyCode = data.CompanyCode;
				oData.PaymentMethod = data.PaymentMethod;
				oData.PaymentTerm = data.PaymentTerm;
				
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
				oData.OfferType = data.OfferType;
				return oData;
			},
			
			getPartnerList: function(){
				var items = this.byId("risks").getItems();
				var list = '';
				for(var i = 0; i < items.length; i++){
					var input = items[i].getContent()[0].getHeaderToolbar().getContent()[1];
					list = list + input.getValue() + ";";
				}
				if(list){
					list = list.slice(0,-1);
				}
				return list;
			},
			
			checkLimits: function(data){
				var oFuncParams = this.collectLimitsData(data);
				this.getModel().callFunction("/CheckValidityLimits", {
					method: "GET",
					urlParameters: oFuncParams,
					success: this.onCheckLimitsSuccess.bind(this, "CheckValidityLimits")
				});
			},
			onCheckLimitsSuccess: function(link, oData) {
				var oResult = oData[link];
				var PaymentIcon = this.byId("limitPaymentConditionIcon");
				var PeriodIcon = this.byId("limitPeriodIcon");
				var TonnageIcon = this.byId("limitTonnageIcon");
				var none = this.getResourceBundle().getText("none");
				oResult.PaymentIcon ? PaymentIcon.setColor(oResult.PaymentIcon).setSrc(this.setIcon(oResult.PaymentIcon)).setVisible(true) : PaymentIcon.setVisible(false);
				oResult.PeriodIcon ? PeriodIcon.setColor(oResult.PeriodIcon).setSrc(this.setIcon(oResult.PeriodIcon)).setVisible(true) : PeriodIcon.setVisible(false);
				oResult.TonnageIcon ? TonnageIcon.setColor(oResult.TonnageIcon).setSrc(this.setIcon(oResult.TonnageIcon)).setVisible(true) : TonnageIcon.setVisible(false);
				this.byId("limitPaymentCondition").setText(oResult.PaymentCondition ? oResult.PaymentCondition : none);
				this.byId("limitPeriod").setText(parseFloat(oResult.Period) ? oResult.Period + " " + oResult.PeriodUoM : none);
				this.byId("limitTonnage").setText(parseFloat(oResult.Tonnage) ? parseFloat(oResult.Tonnage).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " " 
					+ oResult.TonnageUoM : none);
			},
			
			// Sets the icons depending on its color
			setIcon: function(color){
				var icon = "sap-icon://accept";
				if(color === "orange"){
					icon = "sap-icon://message-warning";
				}else if(color === "red"){
					icon = "sap-icon://alert";
				}
				return icon;
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
				this.checkLimits(this.data);
			},
			
			createDeal: function(oEvent){
				
			},
			
			tableDownload: function(oEvent){
				var id = oEvent.getSource().data("id");
				var table = this.byId(id + "Table") || sap.ui.getCore().byId(id + "Table");
				var url = table.getModel().sServiceUrl + table.getSelectedItem().getBindingContextPath() + "/$value";
				window.open(url);
			},
			
			// On select item in Attachments table
			onAttachmentSelect: function(e){
				var listItems = e.getParameters("listItem");
				if (listItems) {
					var id = e.getSource().data("id");
					this.setInput([id + "Delete", id + "Download"], true, "Enabled");
				}
			},
			
			copyOffer: function(oEvent){
				window.open("/sap/bc/ui2/flp#ZTS_OFFER-change?&/" + this.TCNumber + "/Copy");
			},
			
			// Default alert message
			alert: function(msg, settingsArg){
				var settings = settingsArg ? settingsArg : { actions: [sap.m.MessageBox.Action.CLOSE] };
				MessageBox.alert(msg, settings);
			},
			
			// On Compliance Risks list update finished
			checkRisks: function(oEvent){
				var list = oEvent.getSource();
				var risks = list.getItems();
				if(risks.length > 0){
					var type = list.data("type");
					this.isRisk[type] = false;
					if(type === "other"){
						if(risks.length > 0){
							this.isRisk[type] = true;
						}
					}else if(type === "main"){
						for(var i = 0; i < risks.length; i++){
							var color = risks[i].getContent()[0].getItems()[0].getColor();
							if(color === "red" || color === "yellow"){
								this.isRisk[type] = true;
							}
						}
					}
					if(this.isRisk.main || this.isRisk.other){
						this.byId("requestRisk").setEnabled(true);
					}else{
						this.byId("requestRisk").setEnabled(false);
					}
					if((this.status && this.status === "7") || (this.isChanged && this.TCNumber)){
						this.byId("requestRisk").setEnabled(false);
					}
				}
			},
			
			// On Counterparties list update finished
			checkCounterparties: function(oEvent){
				this.checkBlacklist(oEvent);
				this.checkSanctionCountries();
			},
			
			checkBlacklist: function(oEvent){
				var list = oEvent.getSource();
				var counterparties = list.getItems();
				for(var i = 0; i < counterparties.length; i++){
					var blacklist = counterparties[i].getContent()[0].getContent()[0].getItems()[0].getItems()[1].getItems()[1].getText();
					if(blacklist === "Blacklisted"){
						this.isBlacklist = true;
					}
				}
			},
			
			// Checks the ports that are under sanctions
			checkSanctionCountries: function(){
				var volumeData = this.getVolumeData().ToOfferVolume;
				var ports = "";
				for(var i = 0; i < volumeData.length; i++){
					ports = ports + volumeData[i].DeliveryPoint + ";";
				}
				if(ports){
					ports = ports.slice(0,-1);
				}
				var partners = this.getPartnerList();
				var oFuncParams = {
					Partners: partners,
					DeliveryPorts: ports
				};
				this.getModel().callFunction("/GetSanctionCountries", {
					method: "GET",
					urlParameters: oFuncParams,
					success: this.onCheckPortsSuccess.bind(this, "GetSanctionCountries")
				});
			},
			
			onCheckPortsSuccess: function(link, oData) {
				var oResult = oData[link];
				var text = this.byId("countriesSanction");
				if(oResult.SanctionCountries){
					text.setText(oResult.SanctionCountries).addStyleClass("red");
				}else{
					text.setText(this.getResourceBundle().getText("none")).removeStyleClass("red");
				}
			}

		});

	}
);