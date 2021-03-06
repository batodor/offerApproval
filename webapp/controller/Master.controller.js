/*global history */
sap.ui.define([
		"OfferApproval/OfferApproval/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"sap/ui/core/routing/History",
		"sap/ui/model/Filter",
		"sap/ui/model/Sorter",
		"sap/ui/model/FilterOperator",
		"sap/m/GroupHeaderListItem",
		"sap/ui/Device",
		"OfferApproval/OfferApproval/model/formatter"
	], function (BaseController, JSONModel, History, Filter, Sorter, FilterOperator, GroupHeaderListItem, Device, formatter) {
		"use strict";

		return BaseController.extend("OfferApproval.OfferApproval.controller.Master", {

			formatter: formatter,

			/* =========================================================== */
			/* lifecycle methods                                           */
			/* =========================================================== */

			/**
			 * Called when the master list controller is instantiated. It sets up the event handling for the master/detail communication and other lifecycle tasks.
			 * @public
			 */
			onInit : function () {
				// Control state model
				var oList = this.byId("list"),
					oViewModel = this._createViewModel(),
					// Put down master list's original value for busy indicator delay,
					// so it can be restored later on. Busy handling on the master list is
					// taken care of by the master list itself.
					iOriginalBusyDelay = oList.getBusyIndicatorDelay();
				
				this.search = {}; // for searchFields
				this._oList = oList;
				// keeps the filter and search state
				this._oListFilterState = {
					aFilter : [],
					aSearch : []
				};

				this.setModel(oViewModel, "masterView");
				// Make sure, busy indication is showing immediately so there is no
				// break after the busy indication for loading the view's meta data is
				// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
				oList.attachEventOnce("updateFinished", function(){
					// Restore original busy indicator delay for the list
					oViewModel.setProperty("/delay", iOriginalBusyDelay);
				});

				this.getView().addEventDelegate({
					onBeforeFirstShow: function () {
						this.getOwnerComponent().oListSelector.setBoundMasterList(oList);
					}.bind(this)
				});
				
				/*	Sets one function on two router patterns master and object
				*	To run the scripts event when object pattern is matched in master controller so to load master list
				*/
				this.getRouter().getRoute("master").attachPatternMatched(this._onMasterMatched, this);
				this.getRouter().getRoute("object").attachPatternMatched(this._onMasterMatched, this);
				this.getRouter().attachBypassed(this.onBypassed, this);
				
				/* This event is used to transfer or call functions between controllers (master - object) */
				var eventBus = sap.ui.getCore().getEventBus();
			    eventBus.subscribe("DetailMasterChannel", "onApproveEvent", this.onEventBus, this);
			    
			    // Set monday in calendar as first day(not Sunday)
			    sap.ui.core.LocaleData.getInstance(sap.ui.getCore().getConfiguration().getFormatSettings().getFormatLocale()).mData["weekData-firstDay"] = 1;
			},
			
			// Passed data from Detail controller
			onEventBus : function(channel, event) {
				this._oList.getModel().refresh();
			},

			/* =========================================================== */
			/* event handlers                                              */
			/* =========================================================== */

			/**
			 * After list data is available, this handler method updates the
			 * master list counter
			 * @param {sap.ui.base.Event} oEvent the update finished event
			 * @public
			 */
			onUpdateFinished : function (oEvent) {
				// update the master list object counter after new data is loaded
				this._updateListItemCount(oEvent.getParameter("total"));
			},

			/**
			 * Event handler for the master search field. Applies current
			 * filter value and triggers a new search. If the search field's
			 * 'refresh' button has been pressed, no new search is triggered
			 * and the list binding is refresh instead.
			 * @param {sap.ui.base.Event} oEvent the search event
			 * @public
			 */
			onSearch : function (oEvent) {
				if (oEvent.getParameters().refreshButtonPressed) {
					// Search field's 'refresh' button has been pressed.
					// This is visible if you select any master list item.
					// In this case no new search is triggered, we only
					// refresh the list binding.
					this.onRefresh();
					var eventBus = sap.ui.getCore().getEventBus();
					eventBus.publish("DetailMasterChannel", "onRefreshDetail");
					return;
				}

				var sQuery = oEvent.getParameter("query");
				var filters = [];
				if (sQuery) {
					var filter = isNaN(sQuery) ? new Filter("CounterpartyName", FilterOperator.Contains, sQuery) : new Filter("TCNumber", FilterOperator.Contains, sQuery);
					filters.push(filter);
				}
				this._oListFilterState.aSearch = filters;
				this._applyFilterSearch();
			},

			/**
			 * Event handler for refresh event. Keeps filter, sort
			 * and group settings and refreshes the list binding.
			 * @public
			 */
			onRefresh : function () {
				this._oList.getBinding("items").refresh();
			},

			/**
			 * Event handler for the filter, sort and group buttons to open the ViewSettingsDialog.
			 * @param {sap.ui.base.Event} oEvent the button press event
			 * @public
			 */
			onOpenViewSettings : function (oEvent) {
				if(this.type && this.type === "MyOffers" && !this._oViewSettingsDialog){
					this._oViewSettingsDialog = sap.ui.xmlfragment("OfferApproval.OfferApproval.view.MyViewSettingsDialog", this);
					this.getView().addDependent(this._oViewSettingsDialog);
					// forward compact/cozy style into Dialog
					this._oViewSettingsDialog.addStyleClass(this.getOwnerComponent().getContentDensityClass());
				}else if (!this._oViewSettingsDialog) {
					this._oViewSettingsDialog = sap.ui.xmlfragment("OfferApproval.OfferApproval.view.ViewSettingsDialog", this);
					this.getView().addDependent(this._oViewSettingsDialog);
					// forward compact/cozy style into Dialog
					this._oViewSettingsDialog.addStyleClass(this.getOwnerComponent().getContentDensityClass());
				}
				if(!this.type){
					sap.ui.getCore().byId("viewSettingsDialog").removeAllFilterItems();
				}
				var sDialogTab = "sort";
				if (oEvent.getSource() instanceof sap.m.Button) {
					var sButtonId = oEvent.getSource().sId;
					if (sButtonId.match("filter")) {
						sDialogTab = "filter";
					} else if (sButtonId.match("group")) {
						sDialogTab = "group";
					}
				}
				this._oViewSettingsDialog.open(sDialogTab);
			},

			/**
			 * Event handler called when ViewSettingsDialog has been confirmed, i.e.
			 * has been closed with 'OK'. In the case, the currently chosen filters, sorters or groupers
			 * are applied to the master list, which can also mean that they
			 * are removed from the master list, in case they are
			 * removed in the ViewSettingsDialog.
			 * @param {sap.ui.base.Event} oEvent the confirm event
			 * @public
			 */
			onConfirmViewSettingsDialog : function (oEvent) {
				var aFilterItems = oEvent.getParameters().filterItems,
					aFilters = [],
					aCaptions = [];
				
				// update filter state:
				// combine the filter array and the filter string
				aFilterItems.forEach(function (oItem) {
					var key = oItem.getKey();
					var keys = key.split(";");
					for(var i = 0; i < keys.length; i++){ 
						var operator = oItem.data("operator") ? FilterOperator[oItem.data("operator")] : FilterOperator.EQ;
						var settings = { path: oItem.data("name"), operator: operator, value1: keys[i] };
						if(oItem.data("value2")){
							settings.value2 = oItem.data("value2");
						}
						aFilters.push(new Filter(settings));
					}
					aCaptions.push(oItem.getText());
				});
				this._oListFilterState.aFilter = aFilters;
				this._updateFilterBar(aCaptions.join(", "));
				this._applyFilterSearch();
			},
			
			/* On reset filters in View Settings Dialog, clears filter count */
			onResetFilters: function(oEvent){
				var filterDialog = oEvent.getSource();
				var items = filterDialog.getFilterItems();
				for(var i=0;i<items.length;i++){
					if(items[i]["mProperties"].hasOwnProperty("filterCount")){
						items[i].setFilterCount(0);
						items[i].setSelected(false);
					}
				}
			},

			/**
			 * Event handler for the list selection event
			 * @param {sap.ui.base.Event} oEvent the list selectionChange event
			 * @public
			 */
			onSelectionChange : function (oEvent) {
				var oList = oEvent.getSource(),
					bSelected = oEvent.getParameter("selected");

				// skip navigation when deselecting an item in multi selection mode
				if (!(oList.getMode() === "MultiSelect" && !bSelected)) {
					// get the list item, either from the listItem parameter or from the event's source itself (will depend on the device-dependent mode).
					this._showDetail(oEvent.getParameter("listItem") || oEvent.getSource());
				}
			},

			/**
			 * Event handler for the bypassed event, which is fired when no routing pattern matched.
			 * If there was an object selected in the master list, that selection is removed.
			 * @public
			 */
			onBypassed : function () {
				this._oList.removeSelections(true);
			},

			/**
			 * Used to create GroupHeaders with non-capitalized caption.
			 * These headers are inserted into the master list to
			 * group the master list's items.
			 * @param {Object} oGroup group whose text is to be displayed
			 * @public
			 * @returns {sap.m.GroupHeaderListItem} group header with non-capitalized caption.
			 */
			createGroupHeader : function (oGroup) {
				return new GroupHeaderListItem({
					title : oGroup.text,
					upperCase : false
				});
			},

			/**
			 * Event handler for navigating back.
			 * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
			 * If not, it will navigate to the shell home
			 * @public
			 */
			onNavBack : function() {
				var sPreviousHash = History.getInstance().getPreviousHash(),
					oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

				if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
					history.go(-1);
				} else {
					oCrossAppNavigator.toExternal({
						target: {shellHash: "#Shell-home"}
					});
				}
			},

			/* =========================================================== */
			/* begin: internal methods                                     */
			/* =========================================================== */


			_createViewModel : function() {
				return new JSONModel({
					isFilterBarVisible: false,
					filterBarLabel: "",
					delay: 0,
					title: this.getResourceBundle().getText("masterTitleCount", [0]),
					noDataText: this.getResourceBundle().getText("masterListNoDataText"),
					sortBy: "Customer",
					groupBy: "None"
				});
			},
			
			/* After router pattern of master and object are matched bind the to master list  */
			_onMasterMatched :  function(oEvent) {
				//Set the layout property of the FCL control to 'OneColumn'
				this.getModel("appView").setProperty("/layout", "OneColumn");
				this.type = oEvent.getParameter("arguments").type;
				var url = this.type ? "/offerListSet" : "/workitemSet";
				// this.getModel().setSizeLimit(500);
				var settings = {
					path: url,
					template: this._oList['mBindingInfos'].items.template.clone(),
					sorter: { path: "TCNumber", descending: true }
				};
				if(this.type && this.type === "MyOffers"){
					settings.parameters = {
						custom: { AppType: "MO" }
					};
				}
				if(this._oList.getItems().length === 0){
					this._oList.bindItems(settings);
				}
				if(this.type){
					this.byId("filterButton").setVisible(true);
				}else{
					this.byId("filterButton").setVisible(false);
				}
			},

			/**
			 * Shows the selected item on the detail page
			 * On phones a additional history entry is created
			 * @param {sap.m.ObjectListItem} oItem selected Item
			 * @private
			 */
			_showDetail : function (oItem) {
				var bReplace = !Device.system.phone;
				// set the layout property of FCL control to show two columns
				this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
				if(this.type){
					this.getRouter().navTo("object", {
						TCNumber: oItem.getBindingContext().getProperty("TCNumber"),
						type: this.type
					}, bReplace);
				}else{
					this.getRouter().navTo("object", {
						TCNumber: oItem.getBindingContext().getProperty("TCNumber"),
						objectId: oItem.getBindingContext().getProperty("WorkitemID")
					}, bReplace);
				}
			},

			/**
			 * Sets the item count on the master list header
			 * @param {integer} iTotalItems the total number of items in the list
			 * @private
			 */
			_updateListItemCount : function (iTotalItems) {
				var sTitle;
				// only update the counter if the length is final
				if (this._oList.getBinding("items").isLengthFinal()) {
					if(this.type){
						sTitle = this.getResourceBundle().getText("searchOffers", [iTotalItems]);
						if(this.type === "MyOffers"){
							sTitle = this.getResourceBundle().getText("myOffers", [iTotalItems]);
						}
					}else{
						sTitle = this.getResourceBundle().getText("approvalOffers", [iTotalItems]);
					}
					this.getModel("masterView").setProperty("/title", sTitle);
				}
			},

			/**
			 * Internal helper method to apply both filter and search state together on the list binding
			 * @private
			 */
			_applyFilterSearch : function () {
				var aFilters = this._oListFilterState.aSearch.concat(this._oListFilterState.aFilter),
					oViewModel = this.getModel("masterView");
				this._oList.getBinding("items").filter(aFilters, "Application");
				// changes the noDataText of the list in case there are no filter results
				if (aFilters.length !== 0) {
					oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataWithFilterOrSearchText"));
				} else if (this._oListFilterState.aSearch.length > 0) {
					// only reset the no data text to default when no new search was triggered
					oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataText"));
				}
			},

			/**
			 * Internal helper method that sets the filter bar visibility property and the label's caption to be shown
			 * @param {string} sFilterBarText the selected filter value
			 * @private
			 */
			_updateFilterBar : function (sFilterBarText) {
				var oViewModel = this.getModel("masterView");
				oViewModel.setProperty("/isFilterBarVisible", (this._oListFilterState.aFilter.length > 0));
				oViewModel.setProperty("/filterBarLabel", this.getResourceBundle().getText("masterFilterBarText", [sFilterBarText]));
			},
			
			/*	For using custom dates filters in View Settings Dialog fragment 
			*	Also checks the date from or to depends on which was first entered and apply filter accordingly
			*/
			setDateFilter: function(oEvent){
				var dp = oEvent.getSource();
				var dpValue = dp.getDateValue();
				var operator = dp.data("operator");
				var name = dp.data("name");
				var id = dp.data("id");
				var order = dp.data("order");
				var filterDialog = sap.ui.getCore().byId("viewSettingsDialog") || sap.ui.getCore().byId("myViewSettingsDialog");
				var customFilter = filterDialog.getFilterItems()[parseInt(order)];
				customFilter.setFilterCount(1);
				customFilter.setSelected(true);
				customFilter.data("name", name);
				customFilter.setKey(dpValue);
				if(sap.ui.getCore().byId(id).getDateValue()){
					var dp2Value = sap.ui.getCore().byId(id).getDateValue();
					if(operator === "GE"){
						customFilter.setKey(dpValue);
						customFilter.data("value2", dp2Value);
					}else if(operator === "LE"){
						customFilter.setKey(dp2Value);
						customFilter.data("value2", dpValue);
					}
					operator = "BT";
				}
				customFilter.data("operator", operator);
			},
			
			/*	For using custom dates filters in View Settings Dialog fragment 
			*	On table selectionChange event, generates the filter
			*/
			onTableSelect: function(oEvent){
				var table = oEvent.getSource();
				var items = table.getSelectedItems();
				var model = this.getModel();
				var name = table.data("name");
				var key = table.data("key");
				var order = table.data("order");
				var filterDialog = sap.ui.getCore().byId("viewSettingsDialog") || sap.ui.getCore().byId("myViewSettingsDialog");
				var customFilter = filterDialog.getFilterItems()[parseInt(order)];
				customFilter.setFilterCount(1);
				customFilter.setSelected(true);
				customFilter.data("name", name);
				var keys = "";
				for(var i = 0; i < items.length; i++){
					var path = items[i].getBindingContext().getPath();
					keys = keys + model.getData(path)[key] + ";";
				}
				if(keys){
					keys = keys.slice(0, -1);
				}
				customFilter.setKey(keys);
			},
			
			// Search function for all tables
			triggerSearch: function(oEvent) {
				var query = oEvent.getParameter("query") || oEvent.getParameter("selected"),
					id = oEvent.getSource().data('id'),
					key = oEvent.getSource().data('key'),
					customOperator = oEvent.getSource().data('operator'),
					oTable = this.byId(id) || sap.ui.getCore().byId(id),
					filters = [];
					
				if(!this.search[id]){ 
					this.search[id] = {};
				}
				if(typeof query !== "undefined"){
					var operator = FilterOperator.EQ;
					if(customOperator){
						operator = FilterOperator[customOperator];
					}
					this.search[id][key] = new Filter({path: key, operator: operator, value1: query });
				}else{
					delete this.search[id][key];
				}
				
				var filterKeys = Object.keys(this.search[id]);
				for(var i in filterKeys){
					filters.push(this.search[id][filterKeys[i]]);
				}
				var newFilter = new Filter({ filters: filters, and: true });
				if(filters.length === 0){
					newFilter = filters;
				}
				oTable.getBinding("items").filter(newFilter);
			}

		});

	}
);