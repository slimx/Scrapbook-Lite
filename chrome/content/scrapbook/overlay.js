
var ScrapBookBrowserOverlay = {

	lastLocation: "",
	editMode: false,
	infoMode: false,
	resource: null,
	locateMe: null,

	get STRING() {
		if (!this._stringBundle)
			this._stringBundle = document.getElementById("ScrapBookOverlayString");
		return this._stringBundle;
	},
	_stringBundle: null,

	webProgressListener: {
		onLocationChange: function(aProgress, aRequest, aURI) {
			ScrapBookBrowserOverlay.onLocationChange(aURI ? aURI.spec : "about:blank");
		},
		onStateChange      : function(){},
		onProgressChange   : function(){},
		onStatusChange     : function(){},
		onSecurityChange   : function(){},
		onLinkIconAvailable: function(){},
		QueryInterface: function(aIID) {
			if (aIID.equals(Ci.nsIWebProgressListener) ||
			    aIID.equals(Ci.nsISupportsWeakReference) ||
			    aIID.equals(Ci.nsISupports))
				return this;
			throw Components.results.NS_NOINTERFACE;
		},
	},

	init: function()
	{
		document.getElementById("contentAreaContextMenu").addEventListener(
			"popupshowing", this, false
		);
		this.refresh();
		//gBrowser.addProgressListener(this.webProgressListener);
		if (ScrapBookUtils.getPref("ui.contextMenu") && 
		    ScrapBookUtils.getPref("ui.contextSubMenu")) {
			var callback = function() {
				document.getElementById("ScrapBookContextSubmenu").hidden = false;
				for (var i = 1; i <= 9; i++) {
					document.getElementById("ScrapBookContextSubmenu").firstChild.appendChild(
						document.getElementById("ScrapBookContextMenu" + i)
					);
				}
			};
			window.setTimeout(callback, 1000);
		}
		if (ScrapBookUtils.getPref("ui.menuBar.icon")) {
			var menu   = document.getElementById("ScrapBookMenu");
			var button = document.createElement("toolbarbutton");
			var attrs = menu.attributes;
			for (var i = 0; i < attrs.length; i++)
				button.setAttribute(attrs[i].nodeName, attrs[i].nodeValue);
			while (menu.hasChildNodes())
				button.appendChild(menu.firstChild);
			button.removeAttribute("label");
			button.setAttribute("type", "menu");
			button.setAttribute("image", "chrome://scrapbook/skin/main_16.png");
			var menubar = document.getElementById("main-menubar");
			menubar.appendChild(button);
			menubar.removeChild(menu);
		}
		var key = ScrapBookUtils.getPref("key.menubar");
		if (key && key.length == 1) {
			var elt = document.getElementById("ScrapBookMenu");
			elt.setAttribute("accesskey", key);
		}
		var keyMap = {
			"key.sidebar"    : "key_openScrapBookSidebar",
			"key.save"       : "key_ScrapBookCapture",
			"key.saveAs"     : "key_ScrapBookCaptureAs",
			"key.saveAllTabs": "key_ScrapBookSaveAllTabs",
			"key.bookmark"   : "key_BookmarkWithScrapBook",
		};
		for (let [pref, id] in Iterator(keyMap)) {
			var key = ScrapBookUtils.getPref(pref);
			var elt = document.getElementById(id);
            if(!elt)continue;
			if (key && key.length == 1)
				elt.setAttribute("key", key);
			else
				elt.parentNode.removeChild(elt);
		}
        
        
        //--------------------------------------------------------------------------------------------------------------
        ScrapBookUtils.checkContainerExist();
        // local link to des
        var addFunction = function(aNode, aWhere, aWindow){
            let itemId = aNode.itemId;
            var localUri = aNode.uri;

            if (ScrapBookUtils.inScrapbook(itemId) && PlacesUtils.annotations.itemHasAnnotation(itemId, "bookmarkProperties/description"))
            {
                let _localUri =  PlacesUtils.annotations.getItemAnnotation(itemId, "bookmarkProperties/description");
                let file = ScrapBookUtils.convertURLToFile(_localUri);
                if(file.exists())
                {
                    localUri = _localUri;
                    //将书签信息保存
                    ScrapBookUtils.saveBookmarkInfo(localUri,itemId);
                }
            }
        }.toString().replace(/^function.*{|}$/g, "");
        var oldFunction = PlacesUIUtils._openNodeIn.toString().replace(/^function.*{|}$/g, "").replace("openUILinkIn(aNode.uri","openUILinkIn(localUri");
        eval("PlacesUIUtils._openNodeIn=function PUIU_openNodeIn(aNode, aWhere, aWindow) {"+addFunction+oldFunction+"}");

        //del 最新的night如此
        let addFunction2 = function(){
            let aItemId = this.item?this.item.id:this._id;
            if (ScrapBookUtils.inScrapbook(aItemId) && PlacesUtils.annotations.itemHasAnnotation(aItemId, "bookmarkProperties/description"))
            {
                let _localUri =  PlacesUtils.annotations.getItemAnnotation(aItemId, "bookmarkProperties/description");
                let file = ScrapBookUtils.convertURLToFile(_localUri);
                if(file.exists())
                {
                    ScrapBookUtils.saveBookmarkInfo(_localUri,0);

                    let mainWindow = ScrapBookUtils.getMainWin();
                    if(mainWindow.content.location.href==_localUri)
                    {
                        sbContext._updateStatus(false);
                    }
                    if(file.leafName.search(/\.html$/)>-1)
                        file.parent.remove(true);
                    else if(file.leafName.search(/\.maff$/)>-1)
                        file.remove(true);
                }
                else if(file.parent.exists() && file.leafName.search(/\.html$/)>-1)
                {
                    file.parent.remove(true);
                }
            }
        }.toString().replace(/^function.*{|}$/g, "");
        let oldFunction2 = PlacesRemoveItemTransaction.prototype.doTransaction.toString().replace(/^function.*{|}$/g, "");
        //能在构造中修改就好了
        eval("PlacesRemoveItemTransaction.prototype.doTransaction = function RITXN_doTransaction(){"+addFunction2+oldFunction2+"}");
        //PlacesController.prototype._removeRange = function PC__removeRange(range, transactions, removedFolders) {}
        
        //批量选中的 open all
        var addFunction3 = function(aNodes, aEvent, aView)
        {
            let window = this._getWindow(aView);
            let urlsToOpen = [];
            for (var i = 0; i < aNodes.length; i++) {
                let aItemId = aNodes[i].itemId;
                let localUri = aNodes[i].uri;
                if (ScrapBookUtils.inScrapbook(aItemId) && PlacesUtils.annotations.itemHasAnnotation(aItemId, "bookmarkProperties/description")) {
                    let _localUri = PlacesUtils.annotations.getItemAnnotation(aItemId, "bookmarkProperties/description");
                    let file = ScrapBookUtils.convertURLToFile(_localUri);
                    if (file.exists()) {
                        localUri = _localUri;
                        ScrapBookUtils.saveBookmarkInfo(localUri,aItemId);

                    }
                }

                // Skip over separators and folders.
                if (PlacesUtils.nodeIsURI(aNodes[i]))
                    urlsToOpen.push({uri: localUri, isBookmark: PlacesUtils.nodeIsBookmark(aNodes[i])});
            }
            this._openTabset(urlsToOpen, aEvent, window);

        }.toString().replace(/^function.*{|}$/g, "");
        eval("PlacesUIUtils.openURINodesInTabs=function PUIU_openURINodesInTabs(aNodes, aEvent, aView) {"+addFunction3+"}");

        //文件夹 open all
        var addFunction4 = function(aNode)
        {
            let urls = [];
            if (!this.nodeIsContainer(aNode))
                return urls;

            let root = this.getContainerNodeWithOptions(aNode, false, true);
            let result = root.parentResult;
            let wasOpen = root.containerOpen;
            let didSuppressNotifications = false;
            if (!wasOpen) {
                didSuppressNotifications = result.suppressNotifications;
                if (!didSuppressNotifications)
                    result.suppressNotifications = true;

                root.containerOpen = true;
            }

            for (let i = 0; i < root.childCount; ++i) {
                let child = root.getChild(i);
                if (this.nodeIsURI(child)){
                    //check and get
                    let aItemId = child.itemId;
                    let localUri = child.uri;
                    if (ScrapBookUtils.inScrapbook(aItemId) && PlacesUtils.annotations.itemHasAnnotation(aItemId, "bookmarkProperties/description")) {
                        let _localUri = PlacesUtils.annotations.getItemAnnotation(aItemId, "bookmarkProperties/description");
                        let file = ScrapBookUtils.convertURLToFile(_localUri);
                        if (file.exists()) {
                            localUri = _localUri;
                            ScrapBookUtils.saveBookmarkInfo(localUri,aItemId);

                        }
                    }//
                    urls.push({uri: localUri, isBookmark: this.nodeIsBookmark(child)});
                }
            }

            if (!wasOpen) {
                root.containerOpen = false;
                if (!didSuppressNotifications)
                    result.suppressNotifications = false;
            }
            return urls;
        }.toString().replace(/^function.*{|}$/g, "");
        eval("PlacesUtils.getURLsForContainerNode=function PU_getURLsForContainerNode(aNode) {"+addFunction4+"}");

        //build bookmark menu
        let placesContext = document.getElementById("placesContext");
        placesContext.addEventListener("popupshowing",function(event){
            try {

                //let node = event.originalTarget;
                let node = document.popupNode._placesNode;
                //不是书签就不显示
                if(node.type!=0)throw "it's not a bookmark";
                let inSb = ScrapBookUtils.inScrapbook(node.itemId);
                document.getElementById("ScrapbookStorage").hidden = !inSb;
                document.getElementById("ScrapbookStorageSep").hidden = !inSb;
            } catch(e) {
                document.getElementById("ScrapbookStorage").hidden = true;
                document.getElementById("ScrapbookStorageSep").hidden = true;
            }

        },false);

        //slimx todo ?
        //sbUrlBarStatus.init();
        //--------------------------------------------------------------------------------------------------------------
	},

	destroy: function()
	{
		//gBrowser.removeProgressListener(this.webProgressListener);
	},

	rebuild: function()
	{
		ScrapBookMenuHandler.shouldRebuild = true;
	},

    //slimx todo
	refresh: function()
	{
		this.lastLocation = "";
/*		this.editMode = sbPageEditor.TOOLBAR.getAttribute("autoshow") == "true";
		this.infoMode = sbInfoViewer.TOOLBAR.getAttribute("autoshow") == "true";
		document.getElementById("ScrapBookMenu").hidden        = !ScrapBookUtils.getPref("ui.menuBar");
		document.getElementById("ScrapBookStatusPanel").hidden = !ScrapBookUtils.getPref("ui.statusBar");
		document.getElementById("ScrapBookToolsMenu").hidden   = !ScrapBookUtils.getPref("ui.toolsMenu");
		var file = ScrapBookUtils.getScrapBookDir().clone();
		file.append("folders.txt");
		if (file.exists()) {
			ScrapBookUtils.setPref("ui.folderList", ScrapBookUtils.readFile(file));
		}
		else {
			var ids = ScrapBookUtils.getPref("ui.folderList");
			ScrapBookUtils.writeFile(file, ids, "UTF-8");
		}
		this.onLocationChange(gBrowser.currentURI.spec);*/
	},

	getID: function(aURL)
	{
		if (!aURL)
			aURL = gBrowser.currentURI ? gBrowser.currentURI.spec : "";
		var editable = (aURL.indexOf("file") == 0 && aURL.match(/\/data\/(\d{14})\//));
		return editable ? RegExp.$1 : null;
	},

	onLocationChange: function(aURL)
	{
		if (aURL && aURL != (gBrowser.currentURI ? gBrowser.currentURI.spec : ""))
			return;
		if (aURL.indexOf("file") != 0 && aURL == this.lastLocation)
			return;
		var id = this.getID(aURL);
		document.getElementById("ScrapBookToolbox").hidden = id ? false : true;
		if (id) {
			this.resource = ScrapBookUtils.RDF.GetResource("urn:scrapbook:item" + id);
			if (this.editMode)
				window.setTimeout(function() { sbPageEditor.init(id); }, 20);
			else
				window.setTimeout(function() { sbPageEditor.showHide(false); }, 0);
			if (this.infoMode)
				window.setTimeout(function() { sbInfoViewer.init(id); }, 50);
		}
		this.locateMe = null;
		this.lastLocation = aURL;
	},

	buildPopup2: function(aPopup)
	{
		var menuItem;
		menuItem = aPopup.appendChild(document.createElement("menuitem"));
		menuItem.id = "urn:scrapbook:root";
		menuItem.setAttribute("class", "menuitem-iconic bookmark-item");
		menuItem.setAttribute("container", "true");
		menuItem.setAttribute("label", this.STRING.getString("ROOT_FOLDER"));
		aPopup.appendChild(document.createElement("menuseparator"));
		var ids = ScrapBookUtils.getPref("ui.folderList");
		ids = ids ? ids.split("|") : [];
		var shownItems = 0;
		var maxEntries = ScrapBookUtils.getPref("ui.folderList.maxEntries");
		for (var i = 0; i < ids.length && shownItems < maxEntries; i++) {
			if (ids[i].length != 14)
				continue;
			var res = ScrapBookUtils.RDF.GetResource("urn:scrapbook:item" + ids[i]);
			if (!ScrapBookData.exists(res))
				continue;
			menuItem = aPopup.appendChild(document.createElement("menuitem"));
			menuItem.id = res.Value;
			menuItem.setAttribute("class", "menuitem-iconic bookmark-item");
			menuItem.setAttribute("container", "true");
			menuItem.setAttribute("label", ScrapBookData.getProperty(res, "title"));
			shownItems++;
		}
		if (shownItems > 0)
			aPopup.appendChild(document.createElement("menuseparator"));
		menuItem = aPopup.appendChild(document.createElement("menuitem"));
		menuItem.id = "ScrapBookContextPicking";
		menuItem.setAttribute("label", this.STRING.getString("SELECT_FOLDER") + "...");
	},

	destroyPopup: function(aPopup)
	{
		while (aPopup.hasChildNodes())
			aPopup.removeChild(aPopup.lastChild);
	},

    //slimx todo necessary?
	updateFolderPref : function(aResURI)
	{
		if ( aResURI == "urn:scrapbook:root" ) return;
		var oldIDs = ScrapBookUtils.getPref("ui.folderList");
		oldIDs = oldIDs ? oldIDs.split("|") : [];
		var newIDs = [aResURI.substring(18,32)];
		oldIDs.forEach(function(id){ if ( id != newIDs[0] ) newIDs.push(id); });
		newIDs = newIDs.slice(0, ScrapBookUtils.getPref("ui.folderList.maxEntries")).join("|");
		ScrapBookUtils.setPref("ui.folderList", newIDs);
/*		var file = ScrapBookUtils.getScrapBookDir().clone();
		file.append("folders.txt");
		ScrapBookUtils.writeFile(file, newIDs, "UTF-8");*/
	},

	verifyTargetID : function(aTargetID)
	{
		if (aTargetID == "ScrapBookContextPicking") {
			var ret = {};
			window.openDialog(
				"chrome://scrapbook/content/folderPicker.xul", "",
				"modal,chrome,centerscreen,resizable=yes", ret
			);
			return ret.resource ? ret.resource.Value : null;
		}
		if (aTargetID.indexOf("urn:scrapbook:") != 0)
			aTargetID = "urn:scrapbook:root";
		return aTargetID;
	},

	execCapture : function(aPartialEntire, aFrameOnly, aShowDetail, aTargetID,args)
	{
		if ( aPartialEntire == 0 )
		{
			aPartialEntire = this.isSelected() ? 1 : 2;
			aFrameOnly = aPartialEntire == 1;
		}
		aTargetID = this.verifyTargetID(aTargetID);
		if ( !aTargetID ) return;
		var targetWindow = aFrameOnly ? ScrapBookUtils.getFocusedWindow() : window.content;
		var ret = sbContentSaver.captureWindow(targetWindow, aPartialEntire == 1, aShowDetail, aTargetID, 0, null,null,args);
		return ret;
	},

	execCaptureTarget : function(aShowDetail, aTargetID)
	{
		aTargetID = this.verifyTargetID(aTargetID);
		if ( !aTargetID ) return;
		var linkURL;
		try {
			linkURL = gContextMenu.getLinkURL();
		} catch(ex) {
			linkURL = this.getLinkURI();
		}
		if ( !linkURL ) return;
		window.openDialog(
			"chrome://scrapbook/content/capture.xul", "", "chrome,centerscreen,all,resizable,dialog=no",
			[linkURL], document.popupNode.ownerDocument.location.href, aShowDetail, aTargetID, 0, null, null, null
		);
	},

	execBookmark: function(aTargetID)
	{
/*		aTargetID = this.verifyTargetID(aTargetID);
		if (!aTargetID)
			return;
		this.bookmark(aTargetID, 0);*/
        ScrapBookBrowserOverlay.execCapture(2, false, false,'urn:scrapbook:root',{parentId:aTargetID});
	},

	bookmark: function(aResName, aResIndex, aPreset)
	{
		var newItem = ScrapBookData.newItem();
		newItem.type   = "bookmark";
		newItem.source = window.content.location.href;
		newItem.title  = gBrowser.selectedTab.label;
		newItem.icon   = gBrowser.selectedTab.getAttribute("image");
		for (var prop in aPreset)
			newItem[prop] = aPreset[prop];
		ScrapBookData.addItem(newItem, aResName, aResIndex);
		this.updateFolderPref(aResName);
		ScrapBookUtils.refreshGlobal(false);
	},

	execLocate: function(aRes)
	{
		if (!aRes)
			return;
		if (!ScrapBookData.exists(aRes)) {
			sbPageEditor.disable(true);
			return;
		}
		if (document.getElementById("viewScrapBookSidebar").getAttribute("checked"))
			document.getElementById("sidebar").contentWindow.sbMainUI.locate(aRes);
		else {
			this.locateMe = aRes;
			toggleSidebar("viewScrapBookSidebar");
		}
	},

	getLinkURI: function()
	{
		var i = 0;
		var linkURL;
		var curNode = document.popupNode;
		while (++i < 10 && curNode) {
			if ((curNode instanceof HTMLAnchorElement || curNode instanceof HTMLAreaElement ) && 
			    curNode.href) {
				linkURL = curNode.href;
				break;
			}
			curNode = curNode.parentNode;
		}
		if (linkURL)
			return linkURL;
	},

	isSelected : function()
	{
		var sel = ScrapBookUtils.getFocusedWindow().getSelection().QueryInterface(Ci.nsISelectionPrivate);
		var selected = sel.anchorNode !== sel.focusNode || sel.anchorOffset != sel.focusOffset;
		return selected;
	},

	handleEvent: function(event)
	{
		if (event.type == "popupshowing")
			this.onPopupShowing(event);
	},

	_dragStartTime: null,

	handleDragEvents: function(event)
	{
		event.preventDefault();
		switch (event.type) {
			case "dragenter": 
				this._dragStartTime = Date.now();
				break;
			case "dragover": 
				if (this._dragStartTime && Date.now() - this._dragStartTime > 1000) {
					this._dragStartTime = null;
					event.target.doCommand();
				}
				break;
			default: 
		}
	},

	onPopupShowing : function(event)
	{
		if (event.originalTarget.id != "contentAreaContextMenu")
			return;
		var selected, onLink, inFrame, onInput;
		try {
			selected = gContextMenu.isTextSelected;
			onLink   = gContextMenu.onLink && !gContextMenu.onMailtoLink;
			inFrame  = gContextMenu.inFrame;
			onInput  = gContextMenu.onTextInput;
		}
		catch(ex) {
			selected = this.isSelected();
			onLink   = this.getLinkURI() ? true : false;
			inFrame  = document.popupNode.ownerDocument != window.content.document;
			onInput  = document.popupNode instanceof HTMLTextAreaElement || 
			           (document.popupNode instanceof HTMLInputElement && 
			           (document.popupNode.type == "text" || document.popupNode.type == "password"));
		}
		var isActive = selected || onLink || onInput;
		var getElement = function(aID) {
			return document.getElementById(aID);
		};
		var prefContext  = ScrapBookUtils.getPref("ui.contextMenu");
		var prefBookmark = ScrapBookUtils.getPref("ui.bookmarkMenu");
		getElement("ScrapBookContextMenu0").hidden = !prefContext || onInput;
		getElement("ScrapBookContextMenu1").hidden = !prefContext || !selected;
		getElement("ScrapBookContextMenu3").hidden = !prefContext || isActive;
		getElement("ScrapBookContextMenu5").hidden = !prefContext || isActive || !inFrame;
		getElement("ScrapBookContextMenu7").hidden = !prefContext || selected || !onLink;

        //设定快捷菜单是否显示,小于2就隐藏掉
        getElement("ScrapBookContextMenu11").hidden = !prefContext || ScrapBookUtils.getTabSize()<2;

	},

	onMiddleClick: function(event, aFlag)
	{
		if (event.originalTarget.localName == "menu" || event.button != 1)
			return;
		document.getElementById("contentAreaContextMenu").hidePopup();
		switch (aFlag) {
			case 1 : this.execCapture(1, true, true , event.originalTarget.id); break;
			case 3 : this.execCapture(2, false,true , event.originalTarget.id); break;
			case 5 : this.execCapture(2, true, true , event.originalTarget.id); break;
			case 7 : this.execCaptureTarget(true,  event.originalTarget.id); break;
		}
	},

    //------------------------------------------------------------------------------------------------------------------
    buildPopup:function(aPopup,event)
    {
        if(event.target!=aPopup)return;
        this.destroyPopup(aPopup);//必须要清除之前的,因为可能会有更新
        var menuItem;
        let root = Application.bookmarks.menu;
        let children = root.children;
        for each(let i in children)
        {
            if(i.id==Application.storage.get("sb@root",-1))
            {
                this._buildPopup(i,aPopup);
            }
        }
    },

    _buildPopup:function(parent,popup)
    {
        var menuItem;
        let children = parent.children;
        let size = 0;
        for each(let i in children)
        {
            if(i.type=="folder")//menuseparator,bookmark
            {
                menuItem = popup.appendChild(document.createElement("menu"));
                let subPopup = menuItem.appendChild(document.createElement("menupopup"));
                menuItem.setAttribute("label", i.title);
                this._buildPopup(i,subPopup);
                size++;
            }
            //todo 分割线
        }
        //分割线
        if(size>0)
            popup.appendChild(document.createElement("menuseparator"));
        menuItem = popup.appendChild(document.createElement("menuitem"));
		menuItem.value = parent.id;
		menuItem.setAttribute("label",  this.STRING.getString("current_folder"));
    }

};




var ScrapBookMenuHandler = {

	_menu: null,
	baseURL: "",
	shouldRebuild: false,

	_init: function()
	{
		this._menu = document.getElementById("ScrapBookMenu");
		this.baseURL  = ScrapBookUtils.getBaseHref(ScrapBookData.dataSource.URI);
		var dsEnum = this._menu.database.GetDataSources();
		while (dsEnum.hasMoreElements()) {
			var ds = dsEnum.getNext().QueryInterface(Ci.nsIRDFDataSource);
			this._menu.database.RemoveDataSource(ds);
		}
		this._menu.database.AddDataSource(ScrapBookData.dataSource);
		this._menu.builder.rebuild();
		this.shouldRebuild = false;
	},

	onPopupShowing: function(event, aMenuPopup)
	{
		var getElement = function(aID) {
			return document.getElementById(aID);
		};
		var initFlag = false;
		var dsEnum = getElement("ScrapBookMenu").database.GetDataSources();
		while (dsEnum.hasMoreElements()) {
			var ds = dsEnum.getNext().QueryInterface(Ci.nsIRDFDataSource);
			if (ds.URI == ScrapBookData.dataSource.URI)
				initFlag = true;
		}
		if (!initFlag)
			this._init();
		var selected = ScrapBookBrowserOverlay.isSelected();
		if (event.target == aMenuPopup) {
			var label1 = document.getElementById("ScrapBookContextMenu" + (selected ? 1 : 3)).getAttribute("label");
			var label2 = document.getElementById("ScrapBookContextMenu" + (selected ? 2 : 4)).getAttribute("label");
			getElement("ScrapBookMenubarItem1").setAttribute("label", label1);
			getElement("ScrapBookMenubarItem2").setAttribute("label", label2);
			getElement("ScrapBookMenubarItem1").className = "menuitem-iconic " + (selected ? "sb-capture-partial" : "sb-capture-entire");
			getElement("ScrapBookMenubarItem2").className = "menuitem-iconic " + (selected ? "sb-capture-partial" : "sb-capture-entire");
			getElement("ScrapBookMenubarItem5").label = getElement("ScrapBookMenubarItem5").getAttribute("sblabel");
			if (!this.shouldRebuild)
				return;
			this.shouldRebuild = false;
			this._menu.builder.rebuild();
		}
		else {
			if (event.target.firstChild && event.target.firstChild.className.indexOf("sb-capture") >= 0) {
				event.target.firstChild.label     = getElement("ScrapBookMenubarItem1").label;
				event.target.firstChild.className = getElement("ScrapBookMenubarItem1").className;
				return;
			}
			var elt1 = document.createElement("menuseparator");
			var elt2 = document.createElement("menuitem");
			elt2.setAttribute("class", getElement("ScrapBookMenubarItem1").className);
			elt2.setAttribute("label", getElement("ScrapBookMenubarItem1").label);
			elt2.setAttribute("resuri", event.target.parentNode.resource.Value);
			event.target.insertBefore(elt1, event.target.firstChild);
			event.target.insertBefore(elt2, event.target.firstChild);
		}
	},

	onClick: function(event)
	{
		if (event.target.id == "ScrapBookMenubarItem3" || event.target.id == "ScrapBookMenubarItem4")
			return;
		if (event.target.className.indexOf("sb-capture") >= 0) {
			var aShowDetail = event.target.id == "ScrapBookMenubarItem2" || event.button == 1;
			var resURI = event.target.hasAttribute("resuri") ? event.target.getAttribute("resuri") : "urn:scrapbook:root";
			ScrapBookBrowserOverlay.execCapture(0, null, aShowDetail, resURI);
			return;
		}
		if (event.button == 1)
			this._menu.firstChild.hidePopup();
		if (event.target.id.indexOf("urn:scrapbook:") != 0)
			return;
		var res = ScrapBookUtils.RDF.GetResource(event.target.id);
		if (ScrapBookData.isContainer(res)) {
			if (event.button == 1)
				ScrapBookBrowserOverlay.execLocate(res);
			return;
		}
		var id = ScrapBookData.getProperty(res, "id");
		if (!id)
			return;
		var url;
		switch (ScrapBookData.getProperty(res, "type")) {
			case "note"     : url = "chrome://scrapbook/content/note.xul?id=" + id; break;
			case "bookmark" : url = ScrapBookData.getProperty(res, "source");        break;
			default         : url = this.baseURL + "data/" + id + "/index.html";
		}
		var openInTab = ScrapBookUtils.getPref("tabs.open");
		ScrapBookUtils.loadURL(url, openInTab || event.button == 1 || event.ctrlKey || event.shiftKey);
		event.stopPropagation();
	},

	execCaptureAllTabs: function(aTargetID)
	{
		if (!aTargetID)
			aTargetID = ScrapBookBrowserOverlay.verifyTargetID("ScrapBookContextPicking");
		if (!aTargetID)
			return;
		var tabList = [];
		var nodes = gBrowser.mTabContainer.childNodes;
		for (var i = 0; i < nodes.length; i++)
		//slimx edit 排除保护的，和pin的
		if(!nodes[i].getAttribute('tabProtect') && !nodes[i].getAttribute("pinned"))

			tabList.push(nodes[i]);
		this._goNextTab(tabList, aTargetID);
	},

	_goNextTab: function(tabList, aTargetID)
	{
		if (tabList.length == 0)
			return;
		var tab = tabList.shift();
		//gBrowser.selectedTab = tab;
		var win = gBrowser.getBrowserForTab(tab).contentWindow;
		if (win.location.href != "about:blank")
		{
			try {
				sbContentSaver.captureWindow(win, false, false, aTargetID, 0, null);
			} catch(ex) {
			}
		}
        var sepTime = ScrapBookUtils.getPref("save.interval");
		setTimeout(function(){ ScrapBookMenuHandler._goNextTab(tabList, aTargetID); }, sepTime);
	},
};




window.addEventListener("load", function(){ ScrapBookBrowserOverlay.init(); }, false);
window.addEventListener("unload", function(){ ScrapBookBrowserOverlay.destroy(); }, false);


