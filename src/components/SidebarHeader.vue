<template>
  <div id="sidebar-header">
    <b-container>
      <b-row id="nav-row">
        <b-col class="d-flex">
          <img src="/icons/hamburger.svg" alt="menu" class="nav-itm m-2" />
          <img src="/icons/search.svg" alt="search" class="nav-itm m-2" />
          <img src="/icons/add-card-icon.svg" alt="add card" class="nav-itm m-2" />
          <div class="d-flex ml-auto mt-1">
            <img class="nav-itm ml-auto" src="/icons/IPFC-and-logo.svg" alt="IPFC" />
          </div>
        </b-col>
      </b-row>
      <b-row id="tabs-row" class="mt-auto mb-0">
        <div
          id="mine-all"
          class="tab-div"
          :class="selectedTab === 'mine-all' ? 'selected' : 'not-selected'"
          @click="selectTab('mine-all')"
        >
          <p class="tab-title">Mine: all</p>
        </div>
        <div
          id="site-all"
          class="tab-div"
          :class="selectedTab === 'site-all' ? 'selected' : 'not-selected'"
          @click="selectTab('site-all')"
        >
          <p class="tab-title">Site: all</p>
        </div>
        <div
          id="site-mine"
          class="tab-div"
          :class="selectedTab === 'site-mine' ? 'selected' : 'not-selected'"
          @click="selectTab('site-mine')"
        >
          <p class="tab-title">Site: mine</p>
        </div>
      </b-row>
    </b-container>
  </div>
</template>
<script>
export default {
  name: 'SidebarHeader',
  components: {},
  data() {
    return {
      selectedTab: 'site-all',
    };
  },
  methods: {
    selectTab(tab) {
      this.selectedTab = tab;
      this.$emit('selectedTab', tab);
    },
  },
};
</script>
<style scoped>
#sidebar-header {
  height: 85px;
  width: 100%;
  background-color: #323234;
  overflow-y: hidden;
}
.nav-itm {
  /* height: 50%; */
}
.nav-itm:hover {
  cursor: pointer;
}
#tabs-row {
  justify-content: space-evenly;
}
.tab-title {
  margin-top: 5px;
}
.tab-title:hover {
  cursor: pointer;
}
.tab-div {
  border-radius: 5px 5px 0px 0px;
  margin: 5px 0px 0px 0px;
  padding: 0px 5px;
  flex-grow: 1;
  text-align: center;
}
.selected {
  background: #f6f6f6;
  color: black;
}
.not-selected {
  background: #323234;
  color: white;
}
</style>
