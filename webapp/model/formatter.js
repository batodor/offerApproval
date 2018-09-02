sap.ui.define([
	], function () {
		"use strict";

		return {
			/**
			 * Rounds the currency value to 2 digits
			 *
			 * @public
			 * @param {string} sValue value to be formatted
			 * @returns {string} formatted currency value with 2 digits
			 */
			currencyValue : function (sValue) {
				if (!sValue) {
					return "";
				}

				return parseFloat(sValue).toFixed(2);
			},
			
			getFileName: function(fileName){
				if (!fileName) {
					return "";
				}
				return decodeURI(fileName);
			},
			
			formatTitle: function(s, c, v) {
				if (s === "S" || s === "B") {
					return c;
				} else if (s === "P") {
					return v;
				}
			},
			
			getApprovalAction: function(sStatus) {
				switch (sStatus) {
					case "A":
						return "Approved";
					case "R":
						return "Rejected";
					default: return "Not processed";
				}
			},
			
			getApprovalItemIcon: function(sStatus) {
				switch (sStatus) {
					case "A":
						return "sap-icon://accept";
					case "R":
						return "sap-icon://sys-cancel";
					default: return "sap-icon://write-new";
				}
			},
			
			getApprovalIconColor: function(sStatus) {
				switch (sStatus) {
					case "A":
						return sap.ui.core.IconColor.Positive;
					case "R":
						return sap.ui.core.IconColor.Negative;
				}
			}
		};

	}
);