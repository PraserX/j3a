﻿"use strict";

///////////////////////////////////////////////////////////////////////////////////
// Developer notes
///////////////////////////////////////////////////////////////////////////////////
// Chaos of crypto keys:
// =====================
// We using many kinds of cryptokeys. Because of that, we have to know where to use
// this one cryptokey and where the other. There is some description of cryptokes.
// 
// RESOURCE     --> encrypted --> key stored in ACL file (ACL resource)
// ACL RESOURCE --> encrypted --> key stored in ROLES file in specific role/roles
// ROLE         --> encrypted --> key stored in every USER file with this role
// USER         --> encrypted --> key is derivation of input password
// 
// We hope, that this is quite clear. Here is terminology:
//      Resource - encrypted part of web page
//      Acl resource - definition of resource which contains cryptokey
///////////////////////////////////////////////////////////////////////////////////

// Import modules
var Crypter = require('./crypter.js');
var Worker = require('./worker.js');
var Seed = require('./seed.js');
var Acl = require('./acl.js');
var Config = require('./config.js');
var Roles = require('./roles.js');

// Import jQuery library
//var jQuery = require('jquery');
// jQuery still has too many KB, we should use jquery/dist/jquery.min.js to reduce it.
// In a second way, we can you their map file for minimize output file.
// In a third way, we can customize our jQuery lib and insert it into lib/js (or somethig else) and use it
// Or we can use ddd-jquery, but it is pretty old one.

// There is a high probalibility that web is already using jQuery, so we use this one. It means,
// that we don't have to import big jQuery.


///////////////////////////////////////////////////////////////////////////////////
// Constructor / Class definition
///////////////////////////////////////////////////////////////////////////////////

/**
 * @class
 * @classdesc Core class
 * @property {Acl} acl
 * @property {Config} config asdfasd fasdf
 */
function Core() {
    if (!window.jQuery) {
        throw new Error("J3A: jQuery library is required! Import jQuery first! Newest verstion recommended.");
    }
};


///////////////////////////////////////////////////////////////////////////////////
// Properties
///////////////////////////////////////////////////////////////////////////////////

Core.prototype.acl = null;
Core.prototype.config = null;
Core.prototype.version = null;
Core.prototype.crypter = null;
Core.prototype.roles = null;
Core.prototype.seed = null;
Core.prototype.worker = null;

Core.prototype.devMode = false;
Core.prototype.prefix = null;

//Core.prototype.ready = false;
//Core.prototype.done = false;
//Core.prototype.database = "jtadb";


///////////////////////////////////////////////////////////////////////////////////
// Methods
///////////////////////////////////////////////////////////////////////////////////

/**
 * @description Initialization of Core class (loads config and acl)
 * @param {string} uriConfig URL of main configuration file
 */
Core.prototype.Init = function (uriConfig, newVersion = false, prefix = "") {
    var self = this;
    
    this.prefix = prefix + "_";
    
    return new Promise(function (resolve, reject) {
        if (self.devMode) {
            console.log("[CORE] Starting initialization");
        }

        var config = window.localStorage.getItem(self.prefix + 'config');
        var acl = window.localStorage.getItem(self.prefix + 'acl');
        var roles = window.localStorage.getItem(self.prefix + 'roles');
        var version = window.localStorage.getItem(self.prefix + 'version');

        self.crypter = new Crypter();
        self.worker = new Worker();
        self.seed = new Seed(self.prefix);
        self.version = version;
        
        // Disallow jQuery cache --> it producing too many... errors
        jQuery.ajaxSetup({ cache: false });

        if ((config == null) || (acl == null) || (roles == null) || (self.devMode == true) || (newVersion == true)) {
            if (newVersion == true) {

            }

            // Download config.json and acl.json
            if (self.devMode) {
                console.log("[CORE] Downloading config.json, acl.json and roles.json from site");
            }

            // Download config.json
            var jqxhrConfig = jQuery.getJSON(uriConfig, function (response) {
                config = response;
                self.config = new Config();
                self.config.LoadConfig(response);
            }).fail(function (error) {
                if (self.devMode) {
                    console.log("[CORE] Can't donwload 'config.json' file.");
                }
                reject(error);
            });

            // Download acl.json and roles.json after cofign download is complete
            jqxhrConfig.done(function () {

                var refreshRequest = false;

                // Version
                var jqxhrVersion = jQuery.getJSON(self.config.GetUriVersion(), function (response) {
                    version = response;

                    // Check version and if versions are now equal then logout
                    if (self.version != version["page-version"]) {
                        self.PartialLogout();
                        refreshRequest = true;
                    }

                    self.version = version["page-version"];
                }).fail(function (error) {
                    if (self.devMode) {
                        console.log("[CORE] Can't donwload 'version.json' file.");
                    }
                    reject(error);
                });

                // Acl
                var jqxhrAcl = jQuery.getJSON(self.config.GetUriAcl(), function (response) {
                    acl = response;
                    self.acl = new Acl();
                    self.acl.LoadAcl(response);
                }).fail(function (error) {
                    if (self.devMode) {
                        console.log("[CORE] Can't donwload 'acl.json' file.");
                    }
                    reject(error);
                });

                // Roles
                var jqxhrRoles = jQuery.getJSON(self.config.GetUriRoles(), function (response) {
                    roles = response;
                    self.roles = new Roles();
                    self.roles.LoadRoles(response);
                }).fail(function (error) {
                    if (self.devMode) {
                        console.log("[CORE] Can't donwload 'roles.json' file.");
                    }
                    reject(error);
                });

                // Check and set cache after all downloads are complete
                jQuery.when(jqxhrAcl, jqxhrRoles, jqxhrVersion).done(function () {
                    // If cache is allowed, then add config and acl to cache
                    if (self.config.allowCache == "true") {
                        window.localStorage.setItem(self.prefix + 'version', self.version);
                        window.localStorage.setItem(self.prefix + 'config', JSON.stringify(config));
                        window.localStorage.setItem(self.prefix + 'acl', JSON.stringify(acl));
                        window.localStorage.setItem(self.prefix + 'roles', JSON.stringify(roles));
                    } else {
                        window.localStorage.setItem(self.prefix + 'version', self.version);
                    }

                    // Provide auto logout
                    //self.AutoLogout();

                    if (refreshRequest == true) {
                        window.location.href = self.config.GetUriBase(); // Then refresh page
                    }

                    resolve("complete");
                });
            });
        } else {
            var newPageVersion = null;

            // Loads config and acl from cache
            if (self.devMode) {
                console.log("[CORE] Loading config, acl and roles from cache");
            }

            self.config = new Config();
            self.config.LoadConfig(JSON.parse(config));

            self.acl = new Acl();
            self.acl.LoadAcl(JSON.parse(acl));

            self.roles = new Roles();
            self.roles.LoadRoles(JSON.parse(roles));

            //self.AutoLogout();

            // Download version file
            var jqxhrVersion = jQuery.getJSON(self.config.GetUriVersion(), function (response) {
                newPageVersion = response["page-version"];
            }).fail(function (error) {
                if (self.devMode) {
                    console.log("[CORE] Can't donwload 'version.json' file.");
                }
                reject(error);
            });

            // Check version
            jQuery.when(jqxhrVersion).done(function () {
                if (newPageVersion != version) {
                    self.Init(uriConfig, true, self.prefix).then(function () {
                        resolve("complete");
                    });
                } else {
                    resolve("complete");
                }
            });
        }
    });
}

/**
 * @description Check user authorization and process web page
 * @returns {Promise}
 */
Core.prototype.RunPostProcessing = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        // No encrypted elements found - exit
        if (self.worker.LoadElements() == 0) {
            resolve("success");
        }
        
        // Define elements evaluation
        var evaluateElements = function (elements, index) {
            return new Promise(function (resolve, reject) {
                if (self.IsAuthorized(elements[index].resourceId, self.GetUser())) {
                    // Show encrypted element content
                    self.seed.GetElementById(elements[index].resourceId).then(function (element) {
                        self.worker.ReplaceElement(elements[index].resourceId, element);

                        if ((index + 1) < elements.length) {
                            evaluateElements(elements, index + 1);
                            resolve("success");
                        } else {
                            resolve("success");
                        }

                        resolve("success");
                    }).catch(function (error) {
                        reject(error);
                    });
                } else {
                    // Page request denied! Proceed On Denied Action!
                    var oda = elements[index].oda;

                    if (oda == "R") {
                        window.location.href = self.config.GetUriDeniedInfoPage(); // Redirect has highest priority!
                    } else if (oda == "W") {
                        self.worker.ReplaceByWarningElement(elements[index].resourceId, self.config.GetUriDeniedInfoElement());
                    } else if (oda == "H") {
                        // Do nothing
                    } else {
                        // Unknown ODA, then redirect
                        if (self.devMode) {
                            console.log("[CORE] Warning! Unknown ODA!");
                        }
                        window.location.href = self.config.GetUriDeniedInfoPage();
                    }

                    if ((index + 1) < elements.length) {
                        evaluateElements(elements, index + 1);
                        resolve("denied");
                    } else {
                        resolve("denied");
                    }
                }
            });
        }

        // Start element evaluation
        evaluateElements(self.worker.GetElements(), 0).then(function () {
            resolve();
        }).catch(function (error) {
            reject(error);
        });
    });
}

/**
 * @description Enables developer mode
 */
Core.prototype.EnableDevMode = function () {
    this.devMode = true;
}

/**
 * @description Provides login via password
 * @param {string} username Username from form
 * @param {string} password Password from form
 * @param {boolen} sli Stay logged in param
 * @returns {Promise} Return one of these success/failure
 */
Core.prototype.Login = function (username, password, sli) {
    var self = this;

    // From now on we working with promises (async downloading files)
    return new Promise(function (resolve, reject) {

        // Check config definition
        if (self.config == null) {
            if (self.devMode) {
                console.log("[CORE] Config is null, something is wrong.");
            }
            reject("failure");
        }

        // At first clear previous session
        self.PartialLogout();

        // Check params and set default values
        username = typeof username !== 'undefined' ? username : null;
        password = typeof password !== 'undefined' ? password : null;
        sli = typeof sli !== 'undefined' ? sli : false;

        // Precheck of username and password
        if ((username == null) || (password == null)) {
            if (self.devMode) {
                console.log("[CORE] Username or password is wrong...");
            }
            reject("failure");
        }

        // Get URL of user JSON database
        var uriUser = self.config.GetUriUserByUsername(username);

        // Get JSON file
        var jqxhrUser = jQuery.getJSON(uriUser, function (response) {
            // Determine cipher and get other values
            var ciphername = response["secret-algorithm"]["name"];
            var algorithm = {};
            var secret = response["secret"];
            var roles = response["roles"];
            
            // Get specific values for specific ciphers
            if (ciphername == "AES-GCM") {
                algorithm = {
                    name: response["secret-algorithm"]["name"],
                    iv: response["secret-algorithm"]["iv"],
                    tag: response["secret-algorithm"]["tag"]
                };
            } else {
                if (self.devMode) {
                    console.log("[CORE] Algorithm " + ciphername + "is not supported.");
                }
                reject("failure");
            }

            // We have got two types of passwords, standard text password or certificate
            if (response["key-type"] == "password") {
                // Text password operation
                self.crypter.Sha256Key(password, ciphername).then(function (key) {
                    self.crypter.Decrypt(algorithm, key, secret).then(function (plaintext) {
                        // What is a plaintext? Plaintext contains cryptokeys and
                        // algorithms from Roles. Roles contains cryptokeys from
                        // ACL resources.

                        var rolesSecrets = JSON.parse(plaintext);
                        self.GetResources(rolesSecrets).then(function (resources) {

                            // Save user token and username
                            self.crypter.Sha256(username + (new Date()).toDateString()).then(function (result) {
                                var logoutToken = self.crypter.ArrayBufferToHexString(result);
                                self.SaveCredentials(username, roles, logoutToken);

                                resolve("success"); // This is  the end of login process...
                            });
                        }).catch(function (error) {
                            if (self.devMode) {
                                console.log("[CORE] Exception: "); console.log(error);
                            }
                            reject("failure");
                        });

                    }).catch(function (error) {
                        if (self.devMode) {
                            console.log("[CORE] Exception: "); console.log(error);
                        }
                        reject("failure");
                    });
                }).catch(function (error) {
                    if (self.devMode) {
                        console.log("[CORE] Exception: "); console.log(error);
                    }
                    reject("failure");
                });
            } else {
                if (self.devMode) {
                    console.log("[CORE] Exception: Key is asymetric-key type"); console.log(error);
                }
                reject("failure");
            }
        }).fail(function (error) {
            if (self.devMode) {
                console.log("[CORE] jQuery error:"); console.log(error);
            }
            reject("failure");
        });
    });
};

/**
 * @description Provides login via certificate (PEM)
 * @param {string} username Username from form
 * @param {string} cert Certificate location from form
 * @param {boolean} sli Stay logged in param
 * @returns {Promise} Return one of these success/failure
 */
Core.prototype.LoginByPrivateKey = function (username, certificate, sli) {
    // This could be quite confusing part too. Here we using public-key algorithm
    // for encrypting secret --> secret is private-key, which is used for roles
    // secret encryption. Got it?

    // ROLES --> encrypted with AES-GCM --> AES-KEY
    // AES-KEY --> encrypted with RSA-OAEP --> we need private-key to decrypt it

    var self = this;

    return new Promise(function (resolve, reject) {
        // Check config definition
        if (self.config == null) {
            if (self.devMode) {
                console.log("[CORE] Config is null, something is wrong.");
            }
            reject("failure");
        }

        // At first clear previous session
        self.PartialLogout();

        // Check params and set default values
        username = typeof username !== 'undefined' ? username : null;
        certificate = typeof certificate !== 'undefined' ? certificate : null;
        sli = typeof sli !== 'undefined' ? sli : false;

        // Precheck of username and password
        if ((username == null) || (certificate == null)) {
            if (self.devMode) {
                console.log("[CORE] Username or password is wrong...");
            }
            reject("failure");
        }

        // Get URL of user JSON database
        var uriUser = self.config.GetUriUserByUsername(username);

        // Get JSON file
        var jqxhrUser = jQuery.getJSON(uriUser, function (response) {
            if (response["key-type"] == "certificate") {

                // Determine cipher and get other values
                var ciphername = response["secret-algorithm"]["name"];  // symetric ciphername
                var algorithm = {};                                     // used symetric algorithm
                var secret = response["secret"];                        // roles secret
                var roles = response["roles"];

                var keySecret = response["key-secret"];                 // ciphertext encrypted by public-key
                var keyAlgorithm = response["key-algorithm"]["name"];   // used asymetric algorithm

                // Get specific values for specific ciphers
                if (ciphername == "AES-GCM") {
                    algorithm = {
                        name: response["secret-algorithm"]["name"],
                        iv: response["secret-algorithm"]["iv"],
                        tag: response["secret-algorithm"]["tag"]
                    };
                } else {
                    if (self.devMode) {
                        console.log("[CORE] Algorithm " + ciphername + "is not supported.");
                    }
                    reject("failure");
                }
                
                // Import PCKS8 Key (PEM file format)
                self.crypter.Pkcs8Key(certificate, keyAlgorithm).then(function (key) {

                    var publicKeyAlgorithm = { name: keyAlgorithm };

                    // Decrypt secret encrypted by public-key cipher (RSA-OAEP)
                    self.crypter.Decrypt(publicKeyAlgorithm, key, keySecret).then(function (secretKey) {

                        // Now we have got a symetric secret-key so we can continue just like in stadard login procedure

                        self.crypter.RawKey(secretKey, ciphername).then(function (key) {
                            self.crypter.Decrypt(algorithm, key, secret).then(function (plaintext) {
                                // What is a plaintext? Plaintext containt cryptokeys and
                                // algorithms from Roles. Roles contains cryptokeys from
                                // ACL resources.

                                var rolesSecrets = JSON.parse(plaintext);
                                self.GetResources(rolesSecrets).then(function (resources) {

                                    // Save user token and username
                                    self.crypter.Sha256(username + (new Date()).toDateString()).then(function (result) {
                                        var logoutToken = self.crypter.ArrayBufferToHexString(result);
                                        self.SaveCredentials(username, roles, logoutToken);

                                        resolve("success"); // This is  the end of login process...
                                    });
                                }).catch(function (error) {
                                    if (self.devMode) {
                                        console.log("[CORE] Exception: "); console.log(error);
                                    }
                                    reject("failure");
                                });

                            }).catch(function (error) {
                                if (self.devMode) {
                                    console.log("[CORE] Exception: "); console.log(error);
                                }
                                reject("failure");
                            });
                        }).catch(function (error) {
                            if (self.devMode) {
                                console.log("[CORE] Exception: "); console.log(error);
                            }
                            reject("failure");
                        });

                    }).catch(function (error) {
                        if (self.devMode) {
                            console.log("[CORE] Exception: "); console.log(error);
                        }
                        reject("failure");
                    });
                }).catch(function (error) {
                    if (self.devMode) {
                        console.log("[CORE] Exception: "); console.log(error);
                    }
                    reject("failure");
                });
            } else {
                if (self.devMode) {
                    console.log("[CORE] Exception: Key is symetric-key type"); console.log(error);
                }
                reject("failure");
            }
        }).fail(function (error) {
            if (self.devMode) {
                console.log("[CORE] jQuery error:"); console.log(error);
            }
            reject("failure");
        });
    });
}

/**
 * @description Destroy database and remove all user data
 */
Core.prototype.Logout = function () {
    var self = this;

    this.ClearCredentials();
    Seed.ClearDatabase();
}

/**
 * @description Clear all records from DB (do not remove Database it self) and remove all user data
 */
Core.prototype.PartialLogout = function () {
    var self = this;

    this.ClearCredentials();
    this.seed.ClearRecords();
}

/**
 * @description Provides auto logout
 * @deprecated Since 1.0.1 This is not working properly
 */
Core.prototype.AutoLogout = function () {
    var self = this;

    // Provide auto logout
    if (this.config.autoLogout == "true") {
        // Source: W3Schools
        var name = "logoutToken="; var cookieFound = false;
        var decodedCookie = decodeURIComponent(document.cookie);
        var ca = decodedCookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') { c = c.substring(1); }

            if (c.indexOf("logoutToken=") == 0) {
                // If cookie value is not same as value in localStorage, then it's probably injected cookie, so logout.
                if (c.substring("logoutToken=".length, c.length) != window.localStorage.getItem(self.prefix + 'user_logoutToken')) {
                    this.PartialLogout();
                } else {
                    cookieFound = true;
                }
            }
        }

        // If cookie was not found, then logout (browser was previously closed)
        if (cookieFound != true) {
            this.PartialLogout();
        }
    }
}

/**
 * @description Returns current logged user, otherwise returns null
 * @returns {Array}
 */
Core.prototype.GetUser = function () {
    var self = this;

    var username = window.localStorage.getItem(this.prefix + 'user_username');
    var roles = JSON.parse(window.localStorage.getItem(this.prefix + 'user_roles'));

    if (username == null) {
        return null;
    } else {
        return { username: username, roles: roles }
    }
}

/**
 * @description [static] Returns true if someone is logged in, otherwise returns false (fast inline function)
 * @param {string} prefix Prefix which is used for initialization
 * @returns {boolen}
 */
Core.Logged = function (prefix = "") {
    var username = window.localStorage.getItem(prefix + '_' + 'user_username');

    if (username == null) {
        return false;
    } else {
        return true;
    }
}

/**
 * @description [static] Returns true if user has specified role, otherwire returns false (fast inline function)7
 * @param {string} prefix Prefix which is used for initialization
 * @param {string} roleName
 * @returns {boolean}
 */
Core.InRole = function (prefix = "", roleName) {
    var roles = window.localStorage.getItem(prefix + '_' + 'user_roles');

    if (roles == null) {
        return false;
    }

    roles = JSON.parse(roles);
    for (var i = 0; i < roles.length; i++) {
        if (roles[i] == roleName) {
            return true;
        }
    }

    return false;
}

/**
 * @description Returns true if user is authorized, otherwise returns false
 * @param {string} resourceId Web page element resource ID (hex string)
 * @param {Dict} user User object {username: name, roles: [...]}
 * @returns {boolean}
 */
Core.prototype.IsAuthorized = function (resourceId, user) {
    var self = this;
    var resourcePermission = this.acl.GetAclResourcePermissionById(resourceId);

    if (user == null) {
        return false;
    }
    
    var getCompleteInheritance = function (roleName, ilist) {
        // Get complete inheritance by recursion
        var newInher = false;
        
        var role = self.roles.GetRoleByName(roleName);
        for (var i = 0; i < role.inherits.length; i++) {
            if (!(role.inherits[i] in ilist)) {
                newInher = true;
                ilist.push(role.inherits[i]);
            }

            if (newInher == true) {
                newInher = false;
                ilist = getCompleteInheritance(role.inherits[i], ilist);
            }
        }

        if (!(roleName in ilist)) {
            ilist.push(roleName);
        }

        return ilist;
    }

    var completeInheritance = [];
    for (var i = 0; i < user.roles.length; i++) {
        completeInheritance = completeInheritance.concat(getCompleteInheritance(user.roles[i], []));
    }

    for (var i = 0; i < resourcePermission.length; i++) {
        for (var j = 0; j < completeInheritance.length; j++) {
            if (resourcePermission[i] == completeInheritance[j]) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * @description Returns base URL - main page / index.html (defined in config.json)
 * @returns {string}
 */
Core.prototype.GetBaseUrl = function () {
    var self = this;

    return this.config.GetUriBase();
}

/**
 * @description Save user credentials to local storage
 * @param {string} username
 * @param {Array} roles
 * @param {string} logoutToken
 */
Core.prototype.SaveCredentials = function (username, roles, logoutToken) {
    var self = this;
    
    window.localStorage.setItem(self.prefix + 'user_username', username);
    window.localStorage.setItem(self.prefix + 'user_roles', JSON.stringify(roles));
    window.localStorage.setItem(self.prefix + 'user_logoutToken', logoutToken);

    if (self.config.autoLogout == "true") {
        document.cookie = self.prefix + "logoutToken=" + logoutToken;
    }
}

/**
 * @description Removes all credentials in local storage
 */
Core.prototype.ClearCredentials = function () {
    var self = this;

    window.localStorage.removeItem(self.prefix + 'user_username');
    window.localStorage.removeItem(self.prefix + 'user_roles');
    window.localStorage.removeItem(self.prefix + 'user_logoutToken');

    document.cookie = self.prefix + "logoutToken=";
}

/**
 * @description Method provides few complex operations. In the end, all decrypted resources are stored in DB.
 * @param {Array} rolesCryptoKeys
 * @returns {Promise} success/failure
 */
Core.prototype.GetResources = function (rolesCryptoKeys) {
    var self = this;

    return new Promise(function (resolve, reject) {
        // Decrypt roles
        self.DecryptRoles(rolesCryptoKeys, 0).then(function (aclCryptoKeys) {
            // Decrypt acl
            self.DecryptAclResources(aclCryptoKeys, 0).then(function (resourcesCryptoKeys) {
                // No resources on page found
                if (resourcesCryptoKeys.length == 0) {
                    resolve("success");
                } else {
                    var dlResourcesCryptoKeys = self.RemoveDuplicateResources(resourcesCryptoKeys);
                    var dlResourcesIds = self.ExtractIds(dlResourcesCryptoKeys);

                    // Download resources
                    self.DownloadResources(dlResourcesIds).then(function (encryptedResources) {
                        // Decrypt resources
                        self.DecryptResources(dlResourcesCryptoKeys, encryptedResources).then(function (decryptedElements) {
                            self.seed.Insert(decryptedElements);
                            resolve("success");
                        }).catch(function (error) {
                            reject(error);
                        });
                    }).catch(function (error) {
                        reject(error);
                    });
                }
            }).catch(function (error) {
                reject(error);
            });
        }).catch(function (error) {
            reject(error);
        });
    });
}

/**
 * @description Method decrypt cryptokeys stored in roles file (each role has its own cryptokeys)
 * @param {Array} rolesCryptoKeys
 * @param {int} index
 * @returns {Promise} Array of ACL CryptoKeys
 */
Core.prototype.DecryptRoles = function (rolesCryptoKeys, index = 0) {
    var self = this;

    return new Promise(function (resolve, reject) {
        // Get encrypted keys of ACL resources
        var secret = self.roles.GetRoleSecretByName(rolesCryptoKeys[index].role);

        var role = rolesCryptoKeys[index].role;
        var algorithm = rolesCryptoKeys[index].secret.algorithm;
        var rawKey = rolesCryptoKeys[index].secret.key;

        // Import key
        self.crypter.RawKey(rawKey, algorithm.name).then(function (key) {
            // Decrypt cryptokeys of ACL resources
            self.crypter.Decrypt(algorithm, key, secret).then(function (result) {
                // Continue with recursion or end it
                if ((index + 1) != rolesCryptoKeys.length) {
                    // Continue
                    self.DecryptRoles(rolesCryptoKeys, index + 1).then(function (prevResults) {
                        prevResults.push(JSON.parse(result));
                        resolve(prevResults);
                    });
                } else {
                    // End recursion
                    resolve(JSON.parse(result));
                }
            }).catch(function (error) {
                console.log("[CORE] Roles decryption error:"); console.log(error);
                reject("failure");
            });
        }).catch(function (error) {
            console.log("[CORE] roles key import error:"); console.log(error);
            reject("failure");
        });
    });
}

/**
 * @description Method decrypt cryptokeys stored in acl file (each acl resource has its own cryptokeys)
 * @param {Array} aclCryptoKeys
 * @param {int} index
 * @returns {Promise} Array of resources CryptoKeys
 */
Core.prototype.DecryptAclResources = function (aclCryptoKeys, index = 0) {
    var self = this;

    return new Promise(function (resolve, reject) {

        // ACK 0-fix
        if (aclCryptoKeys.length == 0) {
            resolve([]);
        }

        // Get encrypted keys of ACL resources
        var secret = self.acl.GetAclResourceSecretById(aclCryptoKeys[index].resource_id);

        var resource_id = aclCryptoKeys[index].resource_id;
        var algorithm = aclCryptoKeys[index].secret.algorithm;
        var rawKey = aclCryptoKeys[index].secret.key;
        
        // Import key
        self.crypter.RawKey(rawKey, algorithm.name).then(function (key) {
            // Decrypt cryptokeys of ACL resources
            self.crypter.Decrypt(algorithm, key, secret).then(function (result) {
                // Convert to JSON
                var convResult = JSON.parse(result);
                // Add resource identifier to result (cryptokeys and algo)
                convResult.resource_id = resource_id;

                // Continue with recursion or end it
                if ((index + 1) != aclCryptoKeys.length) {
                    // Continue
                    self.DecryptAclResources(aclCryptoKeys, index + 1).then(function (prevResults) {
                        prevResults.push(convResult);
                        resolve(prevResults);
                    });
                } else {
                    // End recursion
                    resolve([convResult]);
                }
            }).catch(function (error) {
                if (self.devMode) {
                    console.log("[CORE] ACL resource decryption error:"); console.log(error);
                }
                reject("failure");
            });
        }).catch(function (error) {
            if (self.devMode) {
                console.log("[CORE] ACL resources key import error:"); console.log(error);
            }
            reject("failure");
        });
    });
}

/**
 * @description Method decrypt web page content stored resource file
 * @param {Array} resourcesCryptoKeys
 * @param {int} index
 * @returns {Promise} Array of resources --> { "id": res_id, "content": content }
 */
Core.prototype.DecryptResources = function (resourcesCryptoKeys, encryptedResources, index = 0) {
    var self = this;

    return new Promise(function (resolve, reject) {
        var secret = self.GetEncryptedResourceById(encryptedResources, resourcesCryptoKeys[index].resource_id);

        var resource_id = resourcesCryptoKeys[index].resource_id;
        var algorithm = resourcesCryptoKeys[index].algorithm;
        var rawKey = resourcesCryptoKeys[index].key;

        // Import key
        self.crypter.RawKey(rawKey, algorithm.name).then(function (key) {
            // Decrypt cryptokeys of ACL resources
            self.crypter.Decrypt(algorithm, key, secret).then(function (result) {
                // Convert to JSON
                var encryptedElement = Object();
                encryptedElement.resource_id = resource_id;
                encryptedElement.content = result;

                // Continue with recursion or end it
                if ((index + 1) != resourcesCryptoKeys.length) {
                    // Continue
                    self.DecryptResources(resourcesCryptoKeys, encryptedResources, index + 1).then(function (prevResults) {
                        prevResults.push(encryptedElement);
                        resolve(prevResults);
                    });
                } else {
                    // End recursion
                    resolve([encryptedElement]);
                }
            }).catch(function (error) {
                if (self.devMode) {
                    console.log("[CORE] Resource decryption error:"); console.log(error);
                }
                reject("failure");
            });
        }).catch(function (error) {
            if (self.devMode) {
                console.log("[CORE] Resource key import error:"); console.log(error);
            }
            reject("failure");
        });
    });
}

/**
 * @description Method dowload all relevant resources
 * @param {Array} resourcesIds
 * @returns {Array}
 */
Core.prototype.DownloadResources = function (resourcesIds, index = 0) {
    // This function using recursion for async dowload all resources.
    // The question is why. First, it is simple, easy and smart.
    // Second, I really don't know if there is better solution,
    // because if I am correct, jQuery this issue solving simillary.

    var self = this;

    return new Promise(function (resolve, reject) {
        var resourceUri = self.config.GetUriResourceById(resourcesIds[index]);
        
        jQuery.getJSON(resourceUri, function (resource) {
            // Continue with recursion or end it
            if ((index + 1) != resourcesIds.length) {
                // Continue
                self.DownloadResources(resourcesIds, index + 1).then(function (prevResources) {
                    resource.resource_id = resourcesIds[index]; // Add resource ID to result structure
                    prevResources.push(resource);
                    resolve(prevResources);
                });
            } else {
                // End recursion
                resource.resource_id = resourcesIds[index];     // Add resource ID to result structure
                resolve([resource]);                            // First item
            }
        }).fail(function (error) {
            reject(error);
        });
    });
}

/**
 * @description Extracts ID from input structure
 * @param {Array} structuredArray
 * @returns {Array} Contains resources IDs
 */
Core.prototype.ExtractIds = function (structuredArray) {
    var self = this;

    var ids = [];

    for (var i = 0; i < structuredArray.length; i++) {
        ids.push(structuredArray[i].resource_id);
    }

    return ids;
}

/**
 * @description Remove duplicate records in resouces array
 * @param {Array} resources
 * @returns {Array}
 */
Core.prototype.RemoveDuplicateResources = function (resources) {
    var self = this;

    // Duplicate less resources
    var dlResources = []

    for (var i = 0; i < resources.length; i++) {
        // Occurrence
        var occ = false;

        for (var j = 0; j < dlResources.length; j++) {
            if (resources[i].resource_id == dlResources[j].resource_id) {
                occ = true;
            }
        }

        // If dlResources not contain resource, then add this resource
        if (occ == false) {
            dlResources.push(resources[i]);
        }
    }

    return dlResources;
}

/**
 * @description Returns resource specified by ID
 * @param {Array} resouces
 * @returns {string} Encrypted resource (secret)
 */
Core.prototype.GetEncryptedResourceById = function (resources, id) {
    var self = this;

    for (var i = 0; i < resources.length; i++) {
        if (resources[i].resource_id == id) {
            return resources[i].ciphertext;
        }
    }

    return null;
}

// Browserify export
module.exports = Core;
